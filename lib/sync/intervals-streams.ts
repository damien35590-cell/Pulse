import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { processActivity } from "@/lib/pipeline/post-import";
import { saveActivities } from "@/lib/import/save";
import { gpsOf } from "@/lib/import/build";
import type { ParsedActivity, TrackPoint } from "@/lib/import/types";
import { saveVmaMetric } from "@/lib/data/training";
import { isValidVma, vmaFromHalfCooper } from "@/lib/training/vma";
import { isRepSession, workRepsOf, type IcuInterval } from "@/lib/training/reps";

/**
 * Courbes des sorties Strava (trace GPS, altitude, cardio…). Intervals.icu les refuse au serveur : un script Tampermonkey
 * (scripts/tampermonkey-intervals-streams.js) les lit dans Chrome et les envoie à /api/sync/streams.
 */

/** Sources des sorties arrivées par le CSV d'Intervals (lib/sync/intervals-runs.ts). */
export const STREAM_SOURCES = ["strava", "intervals"];
/** Fenêtre des sorties dont le script vient chercher les courbes. */
export const STREAM_WINDOW_DAYS = 14;

/** Courbe d'une activité : `data` (latlng : latitudes, `data2` : longitudes). */
export type IntervalsStream = { type: string; data?: (number | boolean | null)[] | null; data2?: (number | null)[] | null };

const series = (streams: IntervalsStream[], type: string): (number | null)[] | null => {
  const d = streams.find((x) => x.type === type)?.data;
  return d ? d.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)) : null;
};

/** Courbes Intervals → points datés (ms) au format des imports FIT/GPX : position, altitude, cardio, cadence, puissance. */
export function pointsFromStreams(streams: IntervalsStream[], startMs: number): TrackPoint[] {
  const time = series(streams, "time");
  if (!time) return [];
  const ll = streams.find((x) => x.type === "latlng"), lat = ll?.data ?? null, lng = ll?.data2 ?? null;
  const alt = series(streams, "altitude"), hr = series(streams, "heartrate"), cad = series(streams, "cadence"), watts = series(streams, "watts");
  const out: TrackPoint[] = [];
  for (let i = 0; i < time.length; i++) {
    const s = time[i];
    if (s == null) continue;
    const p: TrackPoint = { t: startMs + s * 1000 };
    const la = lat?.[i], lo = lng?.[i];
    if (typeof la === "number" && typeof lo === "number" && Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0)) { p.lat = la; p.lng = lo; }
    if (alt?.[i] != null) p.ele = alt[i]!;
    if (hr?.[i] != null && hr[i]! > 0) p.hr = hr[i]!;
    if (cad?.[i] != null && cad[i]! > 0) p.cad = cad[i]!;
    if (watts?.[i] != null && watts[i]! > 0) p.power = watts[i]!;
    out.push(p);
  }
  return out;
}

/** Plus grande distance (m) couverte en `windowS` secondes, d'après les courbes temps et distance cumulée. */
export function bestDistanceIn(streams: IntervalsStream[], windowS: number): number | null {
  const time = series(streams, "time"), dist = series(streams, "distance");
  if (!time || !dist || time.length < 2) return null;
  const last = time[time.length - 1];
  if (last == null || last < windowS) return null;
  let best = 0, j = 0;
  for (let i = 0; i < time.length; i++) {
    const ti = time[i], di = dist[i];
    if (ti == null || di == null) continue;
    if (j < i) j = i;
    while (j + 1 < time.length && time[j + 1] != null && time[j + 1]! - ti <= windowS) j++;
    const dj = dist[j];
    if (dj != null) best = Math.max(best, dj - di);
  }
  return best > 0 ? Math.round(best) : null;
}

/**
 * Sorties récentes sans trace ni série : ce que le script doit aller chercher (tapis sans cardio : sorties de la liste après 14 jours).
 * `key` : la sortie réalise une séance clé ou fractionnée du programme ; le script lit alors aussi son découpage (/intervals).
 */
export async function missingStreams(uid: string) {
  const rows = await prisma.activity.findMany({
    where: {
      userId: uid, type: "RUN", source: { in: STREAM_SOURCES }, externalId: { not: null },
      polyline: null, stream: { is: null }, startedAt: { gte: new Date(Date.now() - STREAM_WINDOW_DAYS * 864e5) },
    },
    orderBy: { startedAt: "asc" },
    select: { externalId: true, startedAt: true, plannedSession: { select: { kind: true, isKeySession: true } } },
  });
  return rows.flatMap((r) => (r.externalId ? [{ externalId: r.externalId, startedAt: r.startedAt.toISOString(), key: isRepSession(r.plannedSession) }] : []));
}

export type StreamsResult = { activityId: string; points: number; gps: boolean; backfilled: number; vma: number | null; reps: number | null };

/**
 * Courbes reçues pour une sortie déjà dans Pulse : trace, altitude et série cardio ajoutées par le rattrapage de saveActivities,
 * puis pipeline (records 5/10 km sur la trace, ruban de zones…) et, pour un test VMA, VMA = meilleure distance sur 6 min / 100.
 * Découpage d'Intervals reçu (séance clé) : répétitions WORK enregistrées dans Activity.workReps (`reps` = leur nombre, null sans découpage).
 * Renvoie null si la sortie est inconnue.
 */
export async function applyStreams(uid: string, externalId: string, streams: IntervalsStream[], intervals?: IcuInterval[] | null): Promise<StreamsResult | null> {
  const a = await prisma.activity.findFirst({
    where: { userId: uid, externalId, source: { in: STREAM_SOURCES } },
    select: { id: true, title: true, startedAt: true, distanceM: true, movingTimeS: true, elapsedTimeS: true, elevationGainM: true },
  });
  if (!a) return null;

  const points = pointsFromStreams(streams, +a.startedAt);
  const gps = gpsOf({ points } as ParsedActivity);
  let backfilled = 0;
  if (points.length > 1) {
    const parsed: ParsedActivity = {
      dedupeKey: `strava-${externalId}`, externalId, source: "strava", fileName: `intervals-${externalId}`,
      type: "RUN", title: a.title, startedAt: a.startedAt.toISOString(), // même départ : saveActivities retrouve la ligne au lieu d'en créer une
      distanceM: a.distanceM, movingTimeS: a.movingTimeS, elapsedTimeS: a.elapsedTimeS ?? a.movingTimeS, elevationGainM: a.elevationGainM, points,
    };
    ({ backfilled } = await saveActivities(uid, [parsed]));
    if (backfilled) await processActivity(a.id, { points: gps });
  }
  const vma = await halfCooperVma(uid, a.id, streams, a.startedAt);
  const work = intervals ? workRepsOf(intervals) : null;
  if (work) await prisma.activity.update({ where: { id: a.id }, data: { workReps: work } });
  if (backfilled || vma != null || work) { revalidatePath("/"); revalidatePath("/activities"); revalidatePath(`/activities/${a.id}`); revalidatePath("/plan"); }
  return { activityId: a.id, points: points.length, gps: gps.length > 1, backfilled, vma, reps: work ? work.reps.length : null };
}

/** Sortie rattachée à un test VMA du programme et sans VMA déjà enregistrée pour elle : VMA = meilleure distance sur 6 min / 100. */
async function halfCooperVma(uid: string, activityId: string, streams: IntervalsStream[], startedAt: Date): Promise<number | null> {
  const test = await prisma.plannedSession.findFirst({ where: { userId: uid, kind: "VMA_TEST", completedActivityId: activityId }, select: { id: true } });
  if (!test) return null;
  if (await prisma.athleteMetric.findFirst({ where: { userId: uid, type: "VMA_KMH", activityId }, select: { id: true } })) return null;
  const d = bestDistanceIn(streams, 360);
  if (d == null) return null;
  const vma = vmaFromHalfCooper(d);
  if (!isValidVma(vma)) return null;
  await saveVmaMetric(uid, vma, "TEST", { measuredAt: startedAt, activityId, note: `Demi-Cooper lu sur la trace : ${d} m en 6 min` });
  return vma;
}
