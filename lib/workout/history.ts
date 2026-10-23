/** Historique de musculation d'un utilisateur, groupé par exercice (une lettre Lafay = un exercice). */
import { prisma } from "../prisma";
import { groupKey, type StrengthRow } from "../analytics/strength";
import { exerciseKey, type SetDetail } from "../exercises";
import { isLafayCode, ladderKey } from "./catalog";

/** Clé de regroupement d'un code d'exercice (même clé que groupKey sur son nom) : pour Lafay, l'échelle de la variante. */
export const historyKey = (code: string, variant?: string | null) =>
  isLafayCode(code) ? ladderKey(variant ?? code) : exerciseKey(code);

/** Clé d'historique la plus récente d'une lettre Lafay (« lafay:a » ou « lafay:a#1 ») : l'échelle que tu pratiques en ce moment. */
export function latestKeyOf(code: string, history: Map<string, StrengthRow[]>): string {
  const base = historyKey(code);
  let best = base, at = history.get(base)?.[0]?.startedAt.getTime() ?? -1;
  for (const [k, rows] of history) {
    if (!k.startsWith(`${base}#`)) continue;
    const t = rows[0]?.startedAt.getTime() ?? -1;
    if (t > at) { best = k; at = t; }
  }
  return best;
}

export const toRow = (e: { name: string; sets: number; reps: number; loadKg: number | null; setsDetail: unknown; activityId: string }, startedAt: Date): StrengthRow => ({
  activityId: e.activityId, startedAt, name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg,
  setsDetail: Array.isArray(e.setsDetail) ? (e.setsDetail as unknown as SetDetail[]) : null,
});

/** Lignes de chaque exercice, de la plus récente à la plus ancienne. */
export async function loadHistory(userId: string): Promise<Map<string, StrengthRow[]>> {
  const found = await prisma.workoutExercise.findMany({
    where: { activity: { userId, type: "WORKOUT" } },
    orderBy: [{ activity: { startedAt: "desc" } }, { position: "asc" }],
    take: 1500,
    select: { activityId: true, name: true, sets: true, reps: true, loadKg: true, setsDetail: true, activity: { select: { startedAt: true } } },
  });
  const by = new Map<string, StrengthRow[]>();
  for (const e of found) {
    const row = toRow(e, e.activity.startedAt), k = groupKey(e.name);
    if (!k) continue;
    const list = by.get(k);
    if (list) list.push(row); else by.set(k, [row]);
  }
  return by;
}
