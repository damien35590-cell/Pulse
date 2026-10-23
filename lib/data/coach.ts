/** Données de contexte pour « Le mot du coach » (page Analyse) : suivi des programmes sur la période, objectif course actif. */
import { prisma } from "../prisma";
import { shiftDay } from "../dates";
import type { PlanAdherence, RunGoal } from "../analytics/coach-notes";

const D = (k: string) => new Date(k + "T00:00:00Z"); // colonnes @db.Date

/**
 * Séances prévues entre `startKey` et la veille de `todayKey` (au plus `endKey`), par programme : faites (complètes ou partielles),
 * prévues (hors séances déplacées) et séances clés manquées. Aujourd'hui n'est pas compté : la séance du jour peut encore être faite.
 */
export async function getPlanAdherence(userId: string, startKey: string, endKey: string, todayKey: string, sport?: "RUN" | "WORKOUT"): Promise<PlanAdherence[]> {
  const last = endKey < todayKey ? endKey : shiftDay(todayKey, -1);
  if (last < startKey) return [];
  const rows = await prisma.plannedSession.findMany({
    where: { userId, date: { gte: D(startKey), lte: D(last) }, status: { not: "MOVED" }, program: { status: { in: ["ACTIVE", "PAUSED", "COMPLETED"] }, ...(sport ? { sport } : {}) } },
    select: { programId: true, status: true, isKeySession: true, program: { select: { name: true, sport: true } } },
  });
  const by = new Map<string, PlanAdherence>();
  for (const r of rows) {
    if (r.program.sport !== "RUN" && r.program.sport !== "WORKOUT") continue;
    const p = by.get(r.programId) ?? { sport: r.program.sport, name: r.program.name, planned: 0, done: 0, missedKey: 0 };
    p.planned++;
    if (r.status === "COMPLETED" || r.status === "PARTIAL") p.done++;
    else if (r.isKeySession) p.missedKey++;
    by.set(r.programId, p);
  }
  return [...by.values()];
}

/** Objectif course actif le plus proche (avec une date) ou le plus récent. */
export async function getRunGoal(userId: string): Promise<RunGoal | null> {
  const g = await prisma.trainingGoal.findFirst({
    where: { userId, sport: "RUN", status: "ACTIVE" }, orderBy: [{ targetDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    select: { title: true, distanceM: true, targetTimeS: true, predictedTimeS: true },
  });
  return g;
}
