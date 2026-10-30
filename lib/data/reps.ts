/**
 * Fractionné d'une sortie face à sa séance du programme (accès base ; calculs : lib/training/reps.ts).
 * La comparaison se fait à la lecture : détacher / rattacher la sortie ou corriger la VMA d'avant la sortie suit tout seul.
 */
import { prisma } from "@/lib/prisma";
import type { RunWorkoutStructure } from "@/types/training";
import { isValidVma } from "@/lib/training/vma";
import { plannedTargets, readWorkReps, reviewReps, type RepsReview } from "@/lib/training/reps";
import { getCurrentVma } from "./training";

export type ActivityReps = RepsReview & { session: { title: string } | null };

/**
 * Fractionné des sorties données (une requête par table, quel que soit le nombre) : répétitions enregistrées, cibles de la séance
 * reliée, calculées avec la dernière VMA mesurée avant chaque sortie (à défaut, la VMA courante). Absentes de la Map sans découpage.
 */
export async function getRepsReviews(userId: string, acts: { id: string; startedAt: Date; workReps: unknown }[]): Promise<Map<string, ActivityReps>> {
  const out = new Map<string, ActivityReps>();
  const withReps = acts.flatMap((a) => { const w = readWorkReps(a.workReps); return w ? [{ ...a, w }] : []; });
  if (!withReps.length) return out;
  const [sessions, metrics] = await Promise.all([
    prisma.plannedSession.findMany({ where: { userId, completedActivityId: { in: withReps.map((a) => a.id) } }, select: { completedActivityId: true, title: true, structure: true } }),
    prisma.athleteMetric.findMany({ where: { userId, type: "VMA_KMH" }, orderBy: { measuredAt: "desc" }, select: { value: true, measuredAt: true } }),
  ]);
  const current = metrics.length ? null : (await getCurrentVma(userId))?.vmaKmh ?? null;
  for (const a of withReps) {
    const s = sessions.find((x) => x.completedActivityId === a.id) ?? null;
    const vma = (metrics.find((m) => m.measuredAt <= a.startedAt && isValidVma(m.value)) ?? metrics.find((m) => isValidVma(m.value)))?.value ?? current;
    const targets = s && vma ? plannedTargets(s.structure as RunWorkoutStructure | null, vma) : [];
    out.set(a.id, { ...reviewReps(a.w, targets, s ? vma : null), session: s && { title: s.title } });
  }
  return out;
}

export async function getActivityReps(userId: string, a: { id: string; startedAt: Date; workReps: unknown }): Promise<ActivityReps | null> {
  return (await getRepsReviews(userId, [a])).get(a.id) ?? null;
}
