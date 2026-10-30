import { revalidatePath } from "next/cache";
import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOverlapping, processActivity } from "@/lib/pipeline/post-import";
import { GOOGLE_FIT_SOURCE } from "@/lib/sync/google-fit";
import { saveActivities } from "@/lib/import/save";
import { gpsOf } from "@/lib/import/build";
import type { ParsedActivity, TrackPoint } from "@/lib/import/types";
import { saveVmaMetric } from "@/lib/data/training";
import { isValidVma, vmaFromHalfCooper } from "@/lib/training/vma";

const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"] as const;
type RunType = (typeof RUN_TYPES)[number];

/** Colonnes utiles de l'export CSV /api/athlete/{id}/activities.csv (celui du site, accepté avec le cookie). */
type IntervalsActivity = {
  id: string;
  type?: string | null;
  name?: string | null;
  file_type?: string | null;
  start_date?: string | null; // UTC
  start_date_local?: string | null;
  distance?: number | null; // m
  moving_time?: number | null; // s
  elapsed_time?: number | null; // s
  total_elevation_gain?: number | null; // m
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  calories?: number | null;
  description?: string | null; // commentaire Strava
};
type IntervalsRun = IntervalsActivity & { type: RunType };

export type RunSyncStats = {
  found: number; runs: number; created: number; updated: number;
  withFile: number; duplicates: number; replacedGoogleFit: number;
  traces: number; vma: number | null; errors: string[];
};

const CSV_URL = (athleteId: string) => `https://intervals.icu/api/athlete/${encodeURIComponent(athleteId)}/activities.csv`;
const int = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isRun = (a: IntervalsActivity): a is IntervalsRun => (RUN_TYPES as readonly string[]).includes(a.type ?? "");

/** CSV (RFC 4180) : champs entre guillemets, virgules et guillemets doublés à l'intérieur, fins de ligne CRLF ou LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const num = (s: string | undefined) => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Lignes du CSV → activités (colonnes repérées par leur nom d'en-tête). */
export function activitiesFromCsv(text: string): IntervalsActivity[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const col = new Map(head.map((h, i) => [h.trim(), i]));
  if (!col.has("id") || !col.has("type")) throw new Error("Export CSV Intervals.icu inattendu (colonnes id/type absentes)");
  const str = (r: string[], k: string) => { const i = col.get(k); const v = i == null ? "" : (r[i] ?? "").trim(); return v || null; };
  const n = (r: string[], k: string) => { const i = col.get(k); return i == null ? null : num(r[i]); };
  return rows.map((r) => ({
    id: str(r, "id") ?? "",
    type: str(r, "type"),
    name: str(r, "name"),
    file_type: str(r, "file_type"),
    start_date: str(r, "start_date"),
    start_date_local: str(r, "start_date_local"),
    distance: n(r, "distance"),
    moving_time: n(r, "moving_time"),
    elapsed_time: n(r, "elapsed_time"),
    total_elevation_gain: n(r, "total_elevation_gain"),
    average_heartrate: n(r, "average_heartrate"),
    max_heartrate: n(r, "max_heartrate"),
    calories: n(r, "calories"),
    description: str(r, "description"),
  })).filter((a) => a.id);
}

function startOf(a: IntervalsActivity): Date | null {
  const s = a.start_date;
  if (!s) return null;
  const t = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Valeur du cookie de session web « i » (sans le préfixe « i= »). */
function sessionCookie(): string {
  const raw = process.env.INTERVALS_SESSION_COOKIE?.trim();
  if (!raw) throw new Error("INTERVALS_SESSION_COOKIE manquant dans Vercel");
  return raw.replace(/^i=/, "");
}

/**
 * Cookie de session SEUL. L'API officielle (/api/v1) refuse les cookies et, avec la clé API, ne renvoie que des
 * coquilles vides pour les sorties Strava : on passe par l'export CSV du site, qui les contient en entier.
 */
const authHeaders = (cookie: string, accept = "text/csv"): Record<string, string> => ({ Cookie: `i=${cookie}`, Accept: accept });

// ───────── Courbes (streams) d'une sortie ─────────

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

async function fetchStreams(id: string, cookie: string): Promise<IntervalsStream[]> {
  const r = await fetch(`https://intervals.icu/api/activity/${encodeURIComponent(id)}/streams`, {
    headers: authHeaders(cookie, "application/json"), cache: "no-store", signal: AbortSignal.timeout(20_000),
  });
  if (!r.ok) throw new Error(`courbes indisponibles (${r.status})`);
  const body: unknown = await r.json();
  return Array.isArray(body) ? (body as IntervalsStream[]) : [];
}

/** Id athlète : variable INTERVALS_ATHLETE_ID, sinon lu dans le cookie (« v2_i200227_… » → « i200227 »). */
function athleteIdOf(cookie: string): string {
  const id = process.env.INTERVALS_ATHLETE_ID?.trim() || /^v\d+_(i\d+)_/.exec(cookie)?.[1];
  if (!id) throw new Error("Id athlète Intervals.icu introuvable (INTERVALS_ATHLETE_ID ou cookie « i »)");
  return id;
}

/** Courbes téléchargées au plus par passage (budget de temps du cron) : le reste au passage suivant. */
export const MAX_TRACES_PER_RUN = 6;

/**
 * Courses (Run, TrailRun, VirtualRun) des `days` derniers jours SANS fichier d'origine (arrivées via Strava) :
 * 1. résumé (CSV) : création, ou reprise de la même sortie détectée par Google Fit, ou mise à jour ;
 * 2. courbes (trace GPS, altitude, cardio…) pour celles qui n'en ont pas encore, via le rattrapage de saveActivities ;
 * 3. pipeline (doublons, records sur la trace, badges, anecdote, séance du programme) ;
 * 4. test VMA du programme : VMA = meilleure distance sur 6 min / 100, enregistrée si pas encore saisie.
 * Les courses avec fichier restent gérées par syncIntervals.
 */
export async function syncIntervalsRuns(uid: string, days = 14): Promise<RunSyncStats> {
  const cookie = sessionCookie();
  const athleteId = athleteIdOf(cookie);
  const since = Date.now() - days * 864e5;

  const res = await fetch(CSV_URL(athleteId), {
    headers: authHeaders(cookie),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 401 || res.status === 403) throw new Error(`Intervals.icu refuse l'accès (${res.status}) : cookie « i » expiré, reconnecte-toi sur intervals.icu et remplace INTERVALS_SESSION_COOKIE`);
  if (!res.ok) throw new Error(`Intervals.icu a répondu ${res.status}`);

  // Tout l'historique arrive (quelques centaines de lignes) : on garde la fenêtre des `days` derniers jours.
  const items = activitiesFromCsv(await res.text()).filter((a) => (startOf(a)?.getTime() ?? 0) >= since);
  const out: RunSyncStats = { found: items.length, runs: 0, created: 0, updated: 0, withFile: 0, duplicates: 0, replacedGoogleFit: 0, traces: 0, vma: null, errors: [] };

  const runs = items.filter(isRun).filter((a) => {
    if (a.file_type) { out.withFile++; return false; }
    return true;
  });
  out.runs = runs.length;
  if (!runs.length) return out;

  const existing = new Map(
    (await prisma.activity.findMany({
      where: { userId: uid, externalId: { in: runs.map((a) => a.id) } },
      select: { id: true, source: true, externalId: true, polyline: true, notes: true },
    })).map((k) => [`${k.source}:${k.externalId}`, k]),
  );

  let traces = 0;
  // Du plus ancien au plus récent : l'ordre des records et des séances du programme suit celui des sorties.
  for (const a of [...runs].sort((x, y) => (startOf(x)?.getTime() ?? 0) - (startOf(y)?.getTime() ?? 0))) {
    const startedAt = startOf(a);
    if (!startedAt) { out.errors.push(`${a.id} : date de départ absente`); continue; }
    // Id numérique = id Strava (même clé que l'import d'archive) ; sinon id propre à Intervals (« i123… »).
    const source = /^\d+$/.test(a.id) ? "strava" : "intervals";
    const title = (a.name?.trim() || "Running").slice(0, 120);
    const note = a.description?.trim() || null;
    const summary = {
      distanceM: a.distance ?? 0,
      movingTimeS: int(a.moving_time) ?? 0,
      elapsedTimeS: int(a.elapsed_time),
      elevationGainM: a.total_elevation_gain ?? 0,
      avgHr: int(a.average_heartrate),
      maxHr: int(a.max_heartrate),
      calories: int(a.calories),
    };
    // Mise à jour : jamais d'écrasement par une valeur vide.
    const update = Object.fromEntries(
      Object.entries(summary).filter(([, v]) => v != null && v !== 0),
    ) as Prisma.ActivityUpdateInput;

    try {
      let id: string, hasTrace: boolean, fresh = false;
      const known = existing.get(`${source}:${a.id}`);
      if (known) {
        await prisma.activity.update({ where: { id: known.id }, data: { ...update, ...(known.notes || !note ? {} : { notes: note }) } });
        out.updated++;
        ({ id } = known); hasTrace = !!known.polyline;
      } else {
        // Même sortie détectée automatiquement par Google Fit : la version Strava fait foi. On reprend sa ligne
        // (ressenti, notes, séance du programme restent) sans toucher à son dedupeKey « gfit-… » (la synchro Google Fit ne la recrée pas).
        const span = { startedAt, movingTimeS: summary.movingTimeS, elapsedTimeS: summary.elapsedTimeS };
        const overlaps = await findOverlapping(uid, span);
        const gfit = overlaps.length
          ? await prisma.activity.findFirst({
              where: { id: { in: overlaps.map((o) => o.id) }, source: GOOGLE_FIT_SOURCE },
              select: { id: true, titleEdited: true, notes: true, polyline: true },
            })
          : null;
        if (gfit) {
          await prisma.activity.update({
            where: { id: gfit.id },
            data: {
              ...update, type: ActivityType.RUN, startedAt, source, externalId: a.id,
              ...(gfit.titleEdited ? {} : { title }),
              ...(gfit.notes || !note ? {} : { notes: note }),
            },
          });
          out.replacedGoogleFit++;
          id = gfit.id; hasTrace = !!gfit.polyline; fresh = true;
        } else {
          const row = await prisma.activity.upsert({
            where: { userId_source_externalId: { userId: uid, source, externalId: a.id } },
            create: {
              user: { connect: { id: uid } }, type: ActivityType.RUN, title, startedAt, source, externalId: a.id,
              dedupeKey: `${source}-${a.id}`, notes: note, ...summary,
            },
            update,
            select: { id: true },
          });
          out.created++;
          id = row.id; hasTrace = false; fresh = true;
        }
      }

      // Courbes : trace GPS (sauf tapis), altitude, cardio. Ajoutées à la ligne existante par le rattrapage de saveActivities.
      let points: TrackPoint[] = [];
      let streams: IntervalsStream[] | null = null;
      if (!hasTrace && a.type !== "VirtualRun" && traces < MAX_TRACES_PER_RUN) {
        traces++;
        try {
          streams = await fetchStreams(a.id, cookie);
          points = pointsFromStreams(streams, +startedAt);
          if (points.length > 1) {
            const parsed: ParsedActivity = {
              dedupeKey: `${source}-${a.id}`, externalId: a.id, source: "strava", fileName: `intervals-${a.id}`,
              type: "RUN", title, startedAt: startedAt.toISOString(),
              distanceM: summary.distanceM, movingTimeS: summary.movingTimeS, elapsedTimeS: summary.elapsedTimeS ?? summary.movingTimeS,
              elevationGainM: summary.elevationGainM, points,
            };
            const r = await saveActivities(uid, [parsed]);
            if (r.backfilled) out.traces++;
          }
        } catch (e) {
          out.errors.push(`${a.id} : courbes, ${msg(e)}`);
        }
      }

      // Pipeline : à la création / reprise, ou quand la trace vient d'arriver (records sur 5 et 10 km, ruban de zones…).
      if (fresh || points.length > 1) {
        const r = await processActivity(id, { points: gpsOf({ points } as ParsedActivity) });
        id = r.activityId ?? id;
      }

      // Test VMA (demi-Cooper) du programme : distance des 6 meilleures minutes, si la VMA n'a pas déjà été saisie pour cette sortie.
      const vma = streams ? await halfCooperVma(uid, id, streams, startedAt) : null;
      if (vma != null) out.vma = vma;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { out.duplicates++; continue; }
      out.errors.push(`${a.id} : ${msg(e)}`);
    }
  }

  if (out.created || out.replacedGoogleFit || out.traces) { revalidatePath("/"); revalidatePath("/activities"); revalidatePath("/vous"); revalidatePath("/analysis"); revalidatePath("/plan"); }
  return out;
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
