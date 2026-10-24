import type { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayKey, weekKeys } from "@/lib/dates";
import { classContext, contextChips, paceInsight, sessionClass, WINDOW_DAYS, type Candidate, type PaceInsight, type SessionClass } from "@/lib/activity/comparables";

const DAY = 86_400_000;
const select = {
  id: true, type: true, startedAt: true, distanceM: true, movingTimeS: true, avgHr: true, rpe: true,
  plannedSession: { select: { kind: true, isKeySession: true } }, raceEvent: { select: { id: true } },
} as const;

type Row = { id: string; type: string; startedAt: Date; distanceM: number; movingTimeS: number; avgHr: number | null; rpe: number | null; plannedSession: { kind: string; isKeySession: boolean } | null; raceEvent: { id: string } | null };
const toCandidate = (r: Row): Candidate => ({ ...r, planned: r.plannedSession, race: !!r.raceEvent });

export type ActivityInsight = { pace: PaceInsight | null; chips: string[]; /** Genre de séance (même classement que la comparaison). */ cls?: SessionClass };
const EMPTY: ActivityInsight = { pace: null, chips: [] };

/** Fenêtre utile d'une activité : 90 jours avant, jusqu'à la fin de son mois et de sa semaine (une journée de marge pour le fuseau). */
function span(a: { startedAt: Date }, tz: string) {
  const [y, m] = dayKey(a.startedAt, tz).split("-").map(Number);
  return {
    start: Math.min(+a.startedAt - WINDOW_DAYS * DAY, Date.UTC(y, m - 1, 1) - DAY),
    end: Math.max(Date.UTC(y, m, 2), Date.parse(weekKeys(a.startedAt, tz)[6]) + 2 * DAY),
  };
}

/**
 * Comparaison d'allure + pastilles de contexte pour plusieurs activités d'un coup (fil, fiche) : trois requêtes au total,
 * quel que soit le nombre d'activités (cibles, fenêtre commune, records).
 */
export async function getActivityInsights(userId: string, ids: string[], tz: string, hrMax?: number | null): Promise<Map<string, ActivityInsight>> {
  const out = new Map<string, ActivityInsight>();
  if (!ids.length) return out;
  const targets = (await prisma.activity.findMany({ where: { id: { in: ids }, userId }, select })).map(toCandidate);
  if (!targets.length) return out;
  const spans = targets.map((t) => span(t, tz));
  const [rows, records] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, type: { in: [...new Set(targets.map((t) => t.type))] as ActivityType[] }, startedAt: { gte: new Date(Math.min(...spans.map((s) => s.start))), lt: new Date(Math.max(...spans.map((s) => s.end))) } },
      select,
    }),
    prisma.personalRecord.findMany({ where: { userId, activityId: { in: targets.map((t) => t.id) } }, select: { kind: true, activityId: true } }),
  ]);
  const all = rows.map(toCandidate);
  targets.forEach((target, i) => {
    const { start, end } = spans[i];
    const pool = all.filter((c) => c.id !== target.id && c.type === target.type && +c.startedAt >= start && +c.startedAt < end);
    const ctx = classContext(target, pool, hrMax);
    const recs = records.filter((r) => r.activityId === target.id).map((r) => r.kind);
    out.set(target.id, { pace: paceInsight(target, pool, ctx), chips: contextChips(target, pool, { tz, records: recs, ctx }), cls: sessionClass(target, ctx) });
  });
  return out;
}

/** Comparaison d'allure + pastilles de contexte pour la fiche d'une activité. */
export async function getActivityInsight(userId: string, activityId: string, tz: string, hrMax?: number | null): Promise<ActivityInsight> {
  return (await getActivityInsights(userId, [activityId], tz, hrMax)).get(activityId) ?? EMPTY;
}
