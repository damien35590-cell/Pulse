import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import type { Pt } from "@/lib/geo";
import { defaultGear } from "@/lib/gear";
import { compareRichness, overlapRatio, OVERLAP_RATIO, processActivity } from "@/lib/pipeline/post-import";
import { refreshZoneRibbon } from "@/lib/data/zone-ribbon";
import { compactTrack } from "./track";
import { activityCreateData, gpsOf, prepStream } from "./build";
import type { ParsedActivity } from "./types";

const KINDS = ["RUN", "RIDE", "EBIKE", "SWIM", "HIKE", "WALK", "WORKOUT", "OTHER"];

/**
 * Enregistre des activités déjà lues (FIT/GPX). Même départ à 90 s près = même sortie : jamais en double.
 * Si la séance existe déjà SANS série détaillée, on lui ajoute celle-ci (rattrapage des séances importées avant l'arrivée de la courbe de puissance).
 * Une activité qui recouvre à plus de 70 % une activité au moins aussi riche est ignorée ; plus riche, elle est créée puis le pipeline fusionne.
 * Records, badges et anecdote : lib/pipeline/post-import.ts.
 */
export async function saveActivities(uid: string, raw: ParsedActivity[]) {
  const items = raw.filter((a) => KINDS.includes(a.type) && !isNaN(Date.parse(a.startedAt)) && a.movingTimeS > 0 && Number.isFinite(a.distanceM));
  if (!items.length) return { saved: 0, duplicates: 0, invalid: raw.length, backfilled: 0 };

  const times = items.map((a) => Date.parse(a.startedAt));
  const [existing, gear] = await Promise.all([
    prisma.activity.findMany({
      where: { userId: uid, startedAt: { gte: new Date(Math.min(...times) - 864e5), lte: new Date(Math.max(...times) + 864e5) } },
      select: { id: true, startedAt: true, movingTimeS: true, elapsedTimeS: true, avgPower: true, avgHr: true, polyline: true, distanceM: true, notes: true, feeling: true, source: true, stream: { select: { activityId: true } }, _count: { select: { exercises: true } } },
    }),
    prisma.gear.findMany({ where: { userId: uid, isDefault: true, retiredAt: null, parentId: null } }),
  ]);
  const match = (a: ParsedActivity) => existing.find((e) => Math.abs(+e.startedAt - Date.parse(a.startedAt)) <= 90e3);
  const covered = (a: ParsedActivity) => {
    const span = { startedAt: new Date(a.startedAt), movingTimeS: a.movingTimeS, elapsedTimeS: a.elapsedTimeS };
    const mine = { power: !!a.stream || (a.avgPower ?? 0) > 0, hr: (a.avgHr ?? 0) > 0, gps: gpsOf(a).length > 1, distance: a.distanceM > 0, manual: false };
    return existing.some((e) => overlapRatio(e, span) > OVERLAP_RATIO && compareRichness(
      { power: !!e.stream || (e.avgPower ?? 0) > 0, hr: (e.avgHr ?? 0) > 0, gps: !!e.polyline, distance: e.distanceM > 0, manual: e._count.exercises > 0 || !!e.notes || !!e.feeling || e.source === "manual" },
      mine,
    ) >= 0);
  };

  let backfilled = 0;
  for (const a of items) {
    const e = match(a);
    if (!e) continue;
    // Séance déjà là SANS trace GPS (ex. arrivée par Google Fit ou un fichier sans GPS) : on lui ajoute celle du fichier.
    const gps = e.polyline || e.source === "mywhoosh" ? [] : gpsOf(a); // home trainer : jamais de trace

    if (gps.length > 1) {
      const stride = Math.max(1, Math.ceil(gps.length / 500)), track = compactTrack(a.points ?? [], 900);
      await prisma.activity.update({
        where: { id: e.id },
        data: {
          polyline: encodePolyline(gps.filter((_, j) => j % stride === 0).map((p) => [p.lat, p.lng])),
          startLat: a.startLat ?? gps[0].lat, startLng: a.startLng ?? gps[0].lng,
          trackPoints: track.length ? (JSON.parse(JSON.stringify(track)) as Prisma.InputJsonValue) : undefined,
        },
      });
      backfilled++;
    }
    if (e.stream) continue;
    const s = prepStream(a);
    if (s) {
      try {
        await prisma.activityStream.create({ data: { activityId: e.id, ...s } });
        backfilled++;
        await refreshZoneRibbon(e.id).catch((err) => console.error("[import] ruban de zones", e.id, err)); // la série vient d'arriver : le ruban aussi
      } catch { /* déjà rattrapée */ }
    }
  }

  const fresh = items.filter((a) => !match(a) && !covered(a));
  let saved = 0;
  for (const a of fresh) {
    const gps = gpsOf(a);
    const g = defaultGear(gear, a.type, gps.length < 2); // sans trace GPS : séance en intérieur (home trainer)
    let id: string;
    try {
      ({ id } = await prisma.activity.create({
        data: { ...activityCreateData(uid, a), gear: g ? { connect: [{ id: g.id }] } : undefined },
        select: { id: true },
      }));
      saved++;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
    await processActivity(id, { points: gps });
  }

  revalidatePath("/"); revalidatePath("/activities"); revalidatePath("/vous"); revalidatePath("/analysis"); revalidatePath("/gear");
  return { saved, duplicates: items.length - saved, invalid: raw.length - items.length, backfilled };
}
