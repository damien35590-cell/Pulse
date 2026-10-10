import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma, type ActivityType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import { bestEffort, type Pt } from "@/lib/geo";
import { activityStory } from "@/lib/insights/engine";
import type { Act } from "@/lib/insights/types";
import type { ParsedActivity } from "@/lib/import/types";

export const maxDuration = 60;
const KINDS = ["RUN", "RIDE", "SWIM", "HIKE", "WALK", "WORKOUT", "OTHER"];

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const raw: ParsedActivity[] = Array.isArray(body?.activities) ? body.activities.slice(0, 10) : [];
  const items = raw.filter((a) => KINDS.includes(a.type) && !isNaN(Date.parse(a.startedAt)) && a.movingTimeS > 0 && Number.isFinite(a.distanceM));
  if (!items.length) return NextResponse.json({ saved: 0, duplicates: 0, invalid: raw.length });

  const times = items.map((a) => Date.parse(a.startedAt));
  const [user, existing] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { timezone: true } }),
    prisma.activity.findMany({ where: { userId: uid, startedAt: { gte: new Date(Math.min(...times) - 120e3), lte: new Date(Math.max(...times) + 120e3) } }, select: { startedAt: true } }),
  ]);
  const tz = user?.timezone ?? "Europe/Paris", ex = existing.map((e) => +e.startedAt);
  // Même départ à 90 s près = même sortie (ex. Strava + MyWhoosh) : on ne l'enregistre qu'une fois.
  const fresh = items.filter((a) => !ex.some((t) => Math.abs(t - Date.parse(a.startedAt)) <= 90e3));
  const asAct = (a: ParsedActivity): Act => ({ id: `${uid}-${Date.parse(a.startedAt)}`, type: a.type, startedAt: new Date(a.startedAt), distanceM: a.distanceM, movingTimeS: a.movingTimeS, elevationGainM: a.elevationGainM, startLat: a.startLat ?? null, startLng: a.startLng ?? null });
  const acts = fresh.map(asAct), best: Record<string, { v: number; at: Date }> = {};

  const rows = fresh.map((a, i) => {
    const pts: Pt[] = (a.points ?? []).filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat!, lng: p.lng!, t: p.t }));
    const track = (a.points ?? []).filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat, lng: p.lng, ele: p.ele, t: p.t }));
    if (a.type === "RUN") for (const [k, m] of [["BEST_5K", 5000], ["BEST_10K", 10000]] as const) { const t = bestEffort(pts, m); if (t != null && (!best[k] || t < best[k].v)) best[k] = { v: t, at: new Date(a.startedAt) }; }
    const hist = acts.filter((o) => o !== acts[i] && +o.startedAt < +acts[i].startedAt && +acts[i].startedAt - +o.startedAt < 30 * 864e5);
    return {
      userId: uid, type: a.type as ActivityType, title: String(a.title || "Activité importée").slice(0, 120), startedAt: new Date(a.startedAt),
      distanceM: a.distanceM, movingTimeS: a.movingTimeS, elapsedTimeS: a.elapsedTimeS ?? null, elevationGainM: a.elevationGainM ?? 0,
      avgHr: a.avgHr ?? null, maxHr: a.maxHr ?? null, calories: a.calories ?? null, startLat: a.startLat ?? null, startLng: a.startLng ?? null,
      polyline: pts.length > 1 ? encodePolyline(pts.map((p) => [p.lat, p.lng])) : null, trackPoints: track.length ? (track as unknown as Prisma.InputJsonValue) : undefined,
      source: a.source, externalId: a.dedupeKey, story: activityStory(acts[i], hist, { tz }).text,
    };
  });

  const res = rows.length ? await prisma.activity.createMany({ data: rows, skipDuplicates: true }) : { count: 0 };
  for (const [kind, b] of Object.entries(best)) {
    const key = { userId_kind_type: { userId: uid, kind: kind as "BEST_5K" | "BEST_10K", type: "RUN" as const } };
    const old = await prisma.personalRecord.findUnique({ where: key });
    if (!old || b.v < old.value) await prisma.personalRecord.upsert({ where: key, update: { value: b.v, achievedAt: b.at }, create: { userId: uid, kind: kind as "BEST_5K" | "BEST_10K", type: "RUN", value: b.v, achievedAt: b.at } });
  }
  revalidatePath("/"); revalidatePath("/activities"); revalidatePath("/profile");
  return NextResponse.json({ saved: res.count, duplicates: items.length - fresh.length, invalid: raw.length - items.length });
}
