import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { groupHistory, type SetDetail } from "@/lib/exercises";

/** Mes exercices passés (noms distincts, par fréquence) avec leurs dernières séances : autocomplétion, préremplissage, progression. */
export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const rows = await prisma.workoutExercise.findMany({
    where: { activity: { userId: uid, type: "WORKOUT" } },
    orderBy: [{ activity: { startedAt: "desc" } }, { position: "asc" }],
    take: 3000,
    select: { name: true, sets: true, reps: true, loadKg: true, restS: true, setsDetail: true, activity: { select: { startedAt: true } } },
  });
  return NextResponse.json(groupHistory(rows.map((r) => ({
    name: r.name, date: r.activity.startedAt.toISOString(), sets: r.sets, reps: r.reps, loadKg: r.loadKg, restS: r.restS,
    setsDetail: Array.isArray(r.setsDetail) ? (r.setsDetail as unknown as SetDetail[]) : null,
  }))));
}
