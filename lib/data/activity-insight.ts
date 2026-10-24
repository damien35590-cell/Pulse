import { prisma } from "@/lib/prisma";
import { dayKey, weekKeys } from "@/lib/dates";
import { classContext, contextChips, paceInsight, WINDOW_DAYS, type Candidate, type PaceInsight } from "@/lib/activity/comparables";

const DAY = 86_400_000;
const select = {
  id: true, type: true, startedAt: true, distanceM: true, movingTimeS: true, avgHr: true, rpe: true,
  plannedSession: { select: { kind: true, isKeySession: true } }, raceEvent: { select: { id: true } },
} as const;

type Row = { id: string; type: string; startedAt: Date; distanceM: number; movingTimeS: number; avgHr: number | null; rpe: number | null; plannedSession: { kind: string; isKeySession: boolean } | null; raceEvent: { id: string } | null };
const toCandidate = (r: Row): Candidate => ({ ...r, planned: r.plannedSession, race: !!r.raceEvent });

/** Comparaison d'allure + pastilles de contexte pour la fiche d'une activité (une requête pour la fenêtre utile). */
export async function getActivityInsight(userId: string, activityId: string, tz: string, hrMax?: number | null): Promise<{ pace: PaceInsight | null; chips: string[] }> {
  const a = await prisma.activity.findFirst({ where: { id: activityId, userId }, select });
  if (!a) return { pace: null, chips: [] };
  const target = toCandidate(a);
  // Fenêtre : 90 jours avant, jusqu'à la fin du mois et de la semaine de l'activité (avec une journée de marge pour le fuseau).
  const [y, m] = dayKey(a.startedAt, tz).split("-").map(Number);
  const end = Math.max(Date.UTC(y, m, 2), Date.parse(weekKeys(a.startedAt, tz)[6]) + 2 * DAY);
  const start = Math.min(+a.startedAt - WINDOW_DAYS * DAY, Date.UTC(y, m - 1, 1) - DAY);
  const [rows, records] = await Promise.all([
    prisma.activity.findMany({ where: { userId, type: a.type, id: { not: a.id }, startedAt: { gte: new Date(start), lt: new Date(end) } }, select }),
    prisma.personalRecord.findMany({ where: { userId, activityId: a.id }, select: { kind: true } }),
  ]);
  const pool = rows.map(toCandidate), ctx = classContext(target, pool, hrMax);
  return { pace: paceInsight(target, pool, ctx), chips: contextChips(target, pool, { tz, records: records.map((r) => r.kind), ctx }) };
}
