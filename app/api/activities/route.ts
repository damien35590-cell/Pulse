import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import { bestEffort, type Pt } from "@/lib/geo";
import { fetchWeather } from "@/lib/weather";
import { activityStory } from "@/lib/insights/engine";
import type { Act } from "@/lib/insights/types";

const TYPES = ["RUN", "RIDE", "SWIM", "HIKE", "WALK", "WORKOUT", "OTHER"] as const;

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  const startedAt = new Date(b?.startedAt);
  if (!b || !TYPES.includes(b.type) || !b.title || !(b.movingTimeS > 0) || isNaN(+startedAt))
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });

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
  const story = activityStory(self, hist as Act[], { tz: user?.timezone ?? "Europe/Paris", lifetimeKmBefore: (life._sum.distanceM ?? 0) / 1000, pr });

  try {
    const a = await prisma.activity.create({
      data: {
        userId: uid, type: b.type, title: String(b.title).slice(0, 120), notes: b.notes ?? null, feeling: b.feeling ?? null, startedAt,
        distanceM: self.distanceM, movingTimeS: self.movingTimeS, elevationGainM: self.elevationGainM, calories: b.calories ?? null,
        polyline, startLat, startLng, weather: weather ?? undefined, story: story.text,
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
