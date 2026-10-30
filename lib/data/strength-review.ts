/**
 * Bilan de séance de la fiche d'une muscu : une seule requête pour l'historique des séances PRÉCÉDENTES (aucune requête par exercice),
 * puis lib/workout/session-review.ts (pur) compare chaque exercice à sa dernière fois et rejoue la règle Lafay.
 */
import { prisma } from "@/lib/prisma";
import { groupKey, type StrengthRow } from "@/lib/analytics/strength-rows";
import { reviewSession, toStrengthRow, type ReviewInput } from "@/lib/workout/session-review";

/** Lignes d'historique lues : de quoi couvrir les dernières séances de chaque exercice (une séance en compte 4 à 6). */
const HISTORY_ROWS = 600;

export async function getSessionReview(userId: string, a: { id: string; startedAt: Date; exercises: ReviewInput[] }) {
  if (!a.exercises.length) return [];
  const keys = new Set(a.exercises.map((e) => groupKey(e.name)).filter(Boolean));
  const found = await prisma.workoutExercise.findMany({
    where: { activityId: { not: a.id }, activity: { userId, type: "WORKOUT", startedAt: { lt: a.startedAt } } },
    orderBy: [{ activity: { startedAt: "desc" } }, { position: "asc" }],
    take: HISTORY_ROWS,
    select: { activityId: true, name: true, sets: true, reps: true, loadKg: true, setsDetail: true, activity: { select: { startedAt: true } } },
  });
  const history = new Map<string, StrengthRow[]>();
  for (const e of found) {
    const k = groupKey(e.name);
    if (!k || !keys.has(k)) continue;
    const list = history.get(k), row = toStrengthRow(e, e.activity.startedAt);
    if (list) list.push(row); else history.set(k, [row]);
  }
  return reviewSession(a.exercises, a.startedAt, history);
}
