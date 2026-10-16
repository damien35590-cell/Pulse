import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import { bestEffort, type Pt } from "@/lib/geo";
import { fetchWeather } from "@/lib/weather";
import { activityStory, workoutStory } from "@/lib/insights/engine";
import type { Act } from "@/lib/insights/types";

const TYPES = ["RUN", "RIDE", "EBIKE", "SWIM", "HIKE", "WALK", "WORKOUT", "OTHER"] as const;

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const startedAt = new Date(b?.startedAt);
  if (!b || !TYPES.includes(b.type) || !b.title || !(b.movingTimeS > 0) || isNaN(+startedAt))
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  // Musculation : blocs d'exercices validés et nettoyés ; pas de distance ni de dénivelé.
  const isWorkout = b.type === "WORKOUT";
  const exercises = isWorkout && Array.isArray(b.exercises)
    ? b.exercises.slice(0, 40).map((e: Record<string, unknown>, i: number) => {
        const load = e?.loadKg == null || e.loadKg === "" ? NaN : Number(e.loadKg), rest = e?.restS == null || e.restS === "" ? NaN : Number(e.restS);
        return { position: i, name: String(e?.name ?? "").trim().slice(0, 80), sets: Math.round(Number(e?.sets)), reps: Math.round(Number(e?.reps)), loadKg: Number.isFinite(load) && load >= 0 ? load : null, restS: Number.isFinite(rest) && rest >= 0 ? Math.round(rest) : null, comment: e?.comment ? String(e.comment).slice(0, 200) : null };
      }).filter((e: { name: string; sets: number; reps: number }) => e.name && e.sets > 0 && e.reps > 0)
    : [];
  if (isWorkout) { b.distanceM = 0; b.elevationGainM = 0; }

  const pts: Pt[] = Array.isArray(b.trackPoints) ? b.trackPoints.slice(0, 20000) : [];
  const startLat = b.startLat ?? pts[0]?.lat ?? null, startLng = b.startLng ?? pts[0]?.lng ?? null;
  const stride = Math.max(1, Math.ceil(pts.length / 500));
  const polyline = pts.length > 1 ? encodePolyline(pts.filter((_, i) => i % stride === 0).map((p) => [p.lat, p.lng])) : null;

  const [user, hist, life, weather] = await Promise.all([
    prisma.user.findUnique({ where: { id: uid }, select: { timezone: true } }),
    prisma.activity.findMany({ where: { userId: uid, startedAt: { gte: new Date(+startedAt - 30 * 864e5), lt: startedAt } }, select: { id: true, type: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true } }),
    prisma.activity.aggregate({ where: { userId: uid, startedAt: { lt: startedAt } }, _sum: { distanceM: true } }),
    startLat != null && startLng != null ? fetchWeather(startLat, startLng, startedAt, b.movingTimeS) : null,
  ]);

  // Records 10 km / 5 km : on n'annonce un record que s'il y avait un ancien temps à battre.
  let pr: { label: string } | null = null;
  if (b.type === "RUN") {
    for (const [kind, label, m] of [["BEST_10K", "10 km", 10000], ["BEST_5K", "5 km", 5000]] as const) {
      const t = bestEffort(pts, m);
      if (t == null) continue;
      const key = { userId_kind_type: { userId: uid, kind, type: "RUN" as const } };
      const old = await prisma.personalRecord.findUnique({ where: key });
      if (!old || t < old.value) {
        await prisma.personalRecord.upsert({ where: key, update: { value: t, achievedAt: startedAt }, create: { userId: uid, kind, type: "RUN", value: t, achievedAt: startedAt } });
        if (old && !pr) pr = { label };
      }
    }
  }

  const self: Act = { id: `${uid}-${+startedAt}`, type: b.type, startedAt, distanceM: b.distanceM ?? 0, movingTimeS: b.movingTimeS, elevationGainM: b.elevationGainM ?? 0, startLat, startLng, weather };
  const volumeKg = exercises.reduce((s: number, e: { sets: number; reps: number; loadKg: number | null }) => s + e.sets * e.reps * (e.loadKg ?? 0), 0);
  const story = isWorkout && exercises.length
    ? workoutStory({ volumeKg, exercises: exercises.length, sets: exercises.reduce((s: number, e: { sets: number }) => s + e.sets, 0) }, self.id)
    : activityStory(self, hist as Act[], { tz: user?.timezone ?? "Europe/Paris", lifetimeKmBefore: (life._sum.distanceM ?? 0) / 1000, pr });

  try {
    const a = await prisma.activity.create({
      data: {
        userId: uid, type: b.type, title: String(b.title).slice(0, 120), notes: b.notes ?? null, feeling: b.feeling ?? null, startedAt,
        distanceM: self.distanceM, movingTimeS: self.movingTimeS, elevationGainM: self.elevationGainM, calories: b.calories ?? null,
        polyline, startLat, startLng, weather: weather ?? undefined, story: story.text,
        exercises: exercises.length ? { create: exercises } : undefined,
        source: b.source ?? "manual", externalId: b.externalId ?? null, trackPoints: pts.length ? (pts as unknown as Prisma.InputJsonValue) : undefined,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: a.id, story: story.text, tag: story.tag, record: !!pr }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "duplicate" }, { status: 409 });
    throw e;
  }
}
