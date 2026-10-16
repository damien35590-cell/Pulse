import { revalidatePath } from "next/cache";
import { Prisma, type ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import { bestEffort, type Pt } from "@/lib/geo";
import { activityStory } from "@/lib/insights/engine";
import type { Act } from "@/lib/insights/types";
import { buildStream, meanNonZero, sanitizeStream } from "@/lib/stream";
import { powerCurve } from "@/lib/power";
import { compactTrack } from "./track";
import type { ParsedActivity } from "./types";

const KINDS = ["RUN", "RIDE", "EBIKE", "SWIM", "HIKE", "WALK", "WORKOUT", "OTHER"];

/** Série à 1 Hz prête à enregistrer (données + courbe de puissance + cadence moyenne), ou null si l'activité n'a ni puissance ni cardio. */
function prepStream(a: ParsedActivity) {
  const st = sanitizeStream(a.stream) ?? buildStream(a.points ?? []);
  if (!st) return null;
  const cad = meanNonZero(st.cad);
  return {
    data: JSON.parse(JSON.stringify(st)) as Prisma.InputJsonValue,
    curve: st.power.length ? (powerCurve(st.power) as Prisma.InputJsonValue) : undefined,
    avgCad: cad > 0 ? Math.round(cad) : null,
  };
}

/**
 * Enregistre des activités déjà lues (FIT/GPX). Même départ à 90 s près = même sortie : jamais en double.
 * Si la séance existe déjà SANS série détaillée, on lui ajoute celle-ci (rattrapage des séances importées avant l'arrivée de la courbe de puissance).
 */
export async function saveActivities(uid: string, raw: ParsedActivity[]) {
  const items = raw.filter((a) => KINDS.includes(a.type) && !isNaN(Date.parse(a.startedAt)) && a.movingTimeS > 0 && Number.isFinite(a.distanceM));
  if (!items.length) return { saved: 0, duplicates: 0, invalid: raw.length, backfilled: 0 };

  const times = items.map((a) => Date.parse(a.startedAt));
  const [user, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { timezone: true } }),
    prisma.activity.findMany({ where: { userId: uid, startedAt: { gte: new Date(Math.min(...times) - 120e3), lte: new Date(Math.max(...times) + 120e3) } }, select: { id: true, startedAt: true, stream: { select: { activityId: true } } } }),
  ]);
  const tz = user?.timezone ?? "Europe/Paris";
  const match = (a: ParsedActivity) => existing.find((e) => Math.abs(+e.startedAt - Date.parse(a.startedAt)) <= 90e3);
  const fresh = items.filter((a) => !match(a));

  let backfilled = 0;
  for (const a of items) {
    const e = match(a);
    if (!e || e.stream) continue;
    const s = prepStream(a);
    if (s) { try { await prisma.activityStream.create({ data: { activityId: e.id, ...s } }); backfilled++; } catch { /* déjà rattrapée */ } }
  }

  const asAct = (a: ParsedActivity): Act => ({ id: `${uid}-${Date.parse(a.startedAt)}`, type: a.type, startedAt: new Date(a.startedAt), distanceM: a.distanceM, movingTimeS: a.movingTimeS, elevationGainM: a.elevationGainM, startLat: a.startLat ?? null, startLng: a.startLng ?? null });
  const acts = fresh.map(asAct), best: Record<string, { v: number; at: Date }> = {};
  const rows = fresh.map((a, i) => {
    const gps: Pt[] = (a.points ?? []).filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat!, lng: p.lng!, t: p.t }));
    const stride = Math.max(1, Math.ceil(gps.length / 500)), track = compactTrack(a.points ?? [], 900);
    if (a.type === "RUN") for (const [k, m] of [["BEST_5K", 5000], ["BEST_10K", 10000]] as const) { const t = bestEffort(gps, m); if (t != null && (!best[k] || t < best[k].v)) best[k] = { v: t, at: new Date(a.startedAt) }; }
    const hist = acts.filter((o) => o !== acts[i] && +o.startedAt < +acts[i].startedAt && +acts[i].startedAt - +o.startedAt < 30 * 864e5);
    return {
      userId: uid, type: a.type as ActivityType, title: String(a.title || "Activité importée").slice(0, 120), startedAt: new Date(a.startedAt),
      distanceM: a.distanceM, movingTimeS: a.movingTimeS, elapsedTimeS: a.elapsedTimeS ?? null, elevationGainM: a.elevationGainM ?? 0,
      avgHr: a.avgHr ? Math.round(a.avgHr) : null, maxHr: a.maxHr ? Math.round(a.maxHr) : null, calories: a.calories ? Math.round(a.calories) : null,
      avgPower: a.avgPower ? Math.round(a.avgPower) : null, maxPower: a.maxPower ? Math.round(a.maxPower) : null,
      startLat: a.startLat ?? null, startLng: a.startLng ?? null,
      polyline: gps.length > 1 ? encodePolyline(gps.filter((_, j) => j % stride === 0).map((p) => [p.lat, p.lng])) : null,
      trackPoints: track.length ? (JSON.parse(JSON.stringify(track)) as Prisma.InputJsonValue) : undefined,
      source: a.source, externalId: a.dedupeKey, dedupeKey: a.dedupeKey, story: activityStory(acts[i], hist, { tz }).text,
    };
  });

  let saved = 0;
  for (let i = 0; i < rows.length; i++) {
    const s = prepStream(fresh[i]);
    try { await prisma.activity.create({ data: { ...rows[i], stream: s ? { create: s } : undefined } }); saved++; }
    catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e; }
  }
  for (const [kind, b] of Object.entries(best)) {
    const key = { userId_kind_type: { userId: uid, kind: kind as "BEST_5K" | "BEST_10K", type: "RUN" as const } };
    const old = await prisma.personalRecord.findUnique({ where: key });
    if (!old || b.v < old.value) await prisma.personalRecord.upsert({ where: key, update: { value: b.v, achievedAt: b.at }, create: { userId: uid, kind: kind as "BEST_5K" | "BEST_10K", type: "RUN", value: b.v, achievedAt: b.at } });
  }
  revalidatePath("/"); revalidatePath("/activities"); revalidatePath("/profile"); revalidatePath("/analysis");
  return { saved, duplicates: items.length - saved, invalid: raw.length - items.length, backfilled };
}
