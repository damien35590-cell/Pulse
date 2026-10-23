import { prisma } from "@/lib/prisma";
import { buildSportRecords, type RecordsBySport } from "@/lib/analytics/records";
import type { StrengthRow } from "@/lib/analytics/strength";
import type { SetDetail } from "@/lib/exercises";

/** Records personnels de la page Vous, regroupés par sport (RUN, RIDE, HIKE, WORKOUT). `types` : le type de chaque sortie, pour l'onglet par défaut. */
export async function getRecordsBySport(userId: string, tz: string, types: string[]): Promise<RecordsBySport> {
  const [prs, streams, exercises] = await Promise.all([
    prisma.personalRecord.findMany({ where: { userId }, select: { kind: true, type: true, value: true, activityId: true, achievedAt: true } }),
    prisma.activityStream.findMany({ where: { activity: { userId, type: "RIDE" } }, select: { activityId: true, curve: true, activity: { select: { startedAt: true } } } }),
    prisma.workoutExercise.findMany({
      where: { activity: { userId, type: "WORKOUT" } },
      select: { activityId: true, name: true, sets: true, reps: true, loadKg: true, setsDetail: true, activity: { select: { startedAt: true } } },
    }),
  ]);
  const counts: Record<string, number> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  const strength: StrengthRow[] = exercises.map((e) => ({
    activityId: e.activityId, startedAt: e.activity.startedAt, name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg,
    setsDetail: Array.isArray(e.setsDetail) ? (e.setsDetail as unknown as SetDetail[]) : null,
  }));
  return buildSportRecords({
    tz, prs, counts, strength,
    curves: streams.map((s) => ({ activityId: s.activityId, startedAt: s.activity.startedAt, curve: Array.isArray(s.curve) ? (s.curve as (number | null)[]) : null })),
  });
}
