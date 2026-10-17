import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import type { Pt } from "@/lib/geo";
import { fetchWeather } from "@/lib/weather";
import { autoGearIds, gearAlerts, ownGearIds } from "@/lib/data/gear";
import { processActivity } from "@/lib/pipeline/post-import";

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
  const rpe = Number.isInteger(b.rpe) && b.rpe >= 1 && b.rpe <= 10 ? (b.rpe as number) : null;

  const pts: Pt[] = Array.isArray(b.trackPoints) ? b.trackPoints.slice(0, 20000) : [];
  const startLat = b.startLat ?? pts[0]?.lat ?? null, startLng = b.startLng ?? pts[0]?.lng ?? null;
  const stride = Math.max(1, Math.ceil(pts.length / 500));
  const polyline = pts.length > 1 ? encodePolyline(pts.filter((_, i) => i % stride === 0).map((p) => [p.lat, p.lng])) : null;

  // Matériel choisi dans la liste déroulante ; à défaut (autres clients), celui par défaut du sport.
  const gearIds = Array.isArray(b.gearIds) ? await ownGearIds(uid, b.gearIds) : await autoGearIds(uid, b.type, startLat == null);
  const weather = startLat != null && startLng != null ? await fetchWeather(startLat, startLng, startedAt, b.movingTimeS) : null;

  try {
    const a = await prisma.activity.create({
      data: {
        userId: uid, type: b.type, title: String(b.title).slice(0, 120), notes: b.notes ?? null, feeling: b.feeling ?? null, rpe, startedAt,
        distanceM: b.distanceM ?? 0, movingTimeS: b.movingTimeS, elevationGainM: b.elevationGainM ?? 0, calories: b.calories ?? null,
        polyline, startLat, startLng, weather: weather ?? undefined,
        exercises: exercises.length ? { create: exercises } : undefined,
        gear: gearIds.length ? { connect: gearIds.map((id) => ({ id })) } : undefined,
        source: b.source ?? "manual", externalId: b.externalId ?? null, trackPoints: pts.length ? (pts as unknown as Prisma.InputJsonValue) : undefined,
      },
      select: { id: true },
    });
    // Doublons, records, badges et anecdote : traitement commun à toutes les sources (lib/pipeline/post-import.ts).
    const post = await processActivity(a.id, { points: pts });
    const worn = gearIds.length ? (await gearAlerts(uid, gearIds)).filter((g) => g.level === "critical").map((g) => ({ name: g.name, kind: g.kind, km: Math.round(g.km), limitKm: g.limitKm })) : [];
    const id = post.activityId ?? a.id;
    // Fusionnée dans une activité qui avait déjà son anecdote : on renvoie celle-ci.
    const story = post.story?.text ?? (await prisma.activity.findUnique({ where: { id }, select: { story: true } }))?.story ?? "";
    return NextResponse.json({
      id, story, tag: post.story?.tag ?? null,
      record: post.records.some((r) => r.beaten && !!r.label), gearAlerts: worn,
    }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return NextResponse.json({ error: "duplicate" }, { status: 409 });
    throw e;
  }
}
