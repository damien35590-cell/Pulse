/**
 * Tests de niveau Lafay en base (LafayTest) : enregistrer, lister, relire avec le précédent, appliquer au programme.
 * Les règles (niveau, tableau du tome 2, ce que change « Appliquer ») sont dans lib/workout/lafay-test.ts.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanHrSeries, hrStats } from "@/lib/workout/hr";
import { cleanWarmup } from "@/lib/workout/warmup";
import { ensureBuiltInTemplates } from "@/lib/workout/builtin";
import { planExercise } from "@/lib/workout/draft";
import { historyKey, loadHistory } from "@/lib/workout/history";
import { applyPlan, cleanResult, resultOf, TEST_REST_S, type DipsTarget, type TestResult } from "@/lib/workout/lafay-test";

export type LafayTestView = {
  id: string;
  takenAt: string;
  result: TestResult;
  prev: TestResult | null;
  appliedAt: string | null;
  applied: AppliedChange | null;
};
export type AppliedChange = { template: string; before: { variant: string | null; sets: number; reps: number } | null; after: DipsTarget };

const SELECT = { id: true, takenAt: true, repsA: true, repsB: true, repsC: true, repsA1: true, appliedAt: true, applied: true } satisfies Prisma.LafayTestSelect;
type Row = Prisma.LafayTestGetPayload<{ select: typeof SELECT }>;
const view = (t: Row, prev: Row | null): LafayTestView => ({
  id: t.id, takenAt: t.takenAt.toISOString(), result: resultOf(t), prev: prev ? resultOf(prev) : null,
  appliedAt: t.appliedAt?.toISOString() ?? null, applied: (t.applied as AppliedChange | null) ?? null,
});

/** Test terminé envoyé par le téléphone. Une durée invraisemblable est ramenée à 4 × 3 min au moins (les repos du test). */
export async function saveLafayTest(userId: string, body: unknown): Promise<string | null> {
  const b = body as { result?: unknown; takenAt?: unknown; durationS?: unknown; hrSeries?: unknown; warmup?: unknown } | null;
  const result = cleanResult(b?.result), takenAt = new Date(String(b?.takenAt));
  if (!result || isNaN(+takenAt)) return null;
  const durationS = Math.min(4 * 3600, Math.max(Math.round(Number(b?.durationS)) || 0, 3 * TEST_REST_S));
  const hr = cleanHrSeries(b?.hrSeries), warmup = cleanWarmup(b?.warmup, durationS);
  const t = await prisma.lafayTest.create({
    data: {
      userId, takenAt, durationS, repsA: result.A, repsB: result.B, repsC: result.C, repsA1: result.A1,
      hrSeries: hrStats(hr) ? (hr as unknown as Prisma.InputJsonValue) : undefined,
      warmup: warmup ?? undefined,
    },
    select: { id: true },
  });
  return t.id;
}

/** Historique, du plus récent au plus ancien, chacun avec le test d'avant (écarts). */
export async function listLafayTests(userId: string): Promise<LafayTestView[]> {
  const rows = await prisma.lafayTest.findMany({ where: { userId }, orderBy: { takenAt: "desc" }, take: 100, select: SELECT });
  return rows.map((t, i) => view(t, rows[i + 1] ?? null));
}

export async function getLafayTest(userId: string, id: string): Promise<LafayTestView | null> {
  const t = await prisma.lafayTest.findFirst({ where: { id, userId }, select: SELECT });
  if (!t) return null;
  const prev = await prisma.lafayTest.findFirst({ where: { userId, takenAt: { lt: t.takenAt } }, orderBy: { takenAt: "desc" }, select: SELECT });
  return view(t, prev);
}

/** Dernier test : valeurs de départ des steppers et ligne « Programme › Muscu ». */
export async function lastLafayTest(userId: string): Promise<{ takenAt: string; result: TestResult } | null> {
  const t = await prisma.lafayTest.findFirst({ where: { userId }, orderBy: { takenAt: "desc" }, select: SELECT });
  return t ? { takenAt: t.takenAt.toISOString(), result: resultOf(t) } : null;
}

const HAUT = "HAUT" as const;

/** Les dips de la prochaine séance « Haut du corps », tels que la séance les proposera (modèle + historique, règle Lafay). */
export async function currentDips(userId: string): Promise<{ template: string; target: { variant: string | null; sets: number; reps: number } | null }> {
  await ensureBuiltInTemplates(userId);
  const [t, history] = await Promise.all([
    prisma.workoutTemplate.findFirst({ where: { userId, isBuiltIn: true, kind: HAUT }, include: { exercises: { orderBy: { order: "asc" } } } }),
    loadHistory(userId),
  ]);
  const row = t?.exercises.find((e) => e.exerciseCode === "B");
  if (!t || !row) return { template: t?.name ?? "Haut du corps", target: null };
  const s = { code: row.exerciseCode, variant: row.variant, sets: row.sets, reps: row.targetReps, restSec: row.restSec, restAfterSec: row.restAfterSec, loadKg: row.loadKg, note: row.note };
  const d = planExercise(s, history.get(historyKey(s.code, s.variant)) ?? []);
  return { template: t.name, target: { variant: d.variant, sets: d.sets, reps: d.reps } };
}

/**
 * « Appliquer à mon programme », confirmé : la ligne de dips du modèle « Haut du corps » prend la cible du niveau conseillé,
 * et le test devient le point de départ de la progression des dips (LafayTest.appliedAt). Rien d'autre n'est modifié.
 */
export async function applyLafayTest(userId: string, id: string): Promise<AppliedChange | null> {
  const t = await prisma.lafayTest.findFirst({ where: { id, userId }, select: { id: true, repsB: true, appliedAt: true } });
  if (!t || t.appliedAt) return null;
  const plan = applyPlan(t.repsB);
  if (plan.kind !== "dips") return null;
  const cur = await currentDips(userId);
  const tpl = await prisma.workoutTemplate.findFirst({ where: { userId, isBuiltIn: true, kind: HAUT }, include: { exercises: { orderBy: { order: "asc" } } } });
  if (!tpl) return null;
  const a = plan.after, row = tpl.exercises.find((e) => e.exerciseCode === "B");
  const data = { exerciseCode: "B", variant: a.variant, sets: a.sets, targetReps: a.reps, restSec: a.restSec, restAfterSec: a.restAfterSec, note: a.note };
  const change: AppliedChange = { template: tpl.name, before: cur.target, after: a };
  // Pas de ligne de dips (modèle modifié) : elle est ajoutée en tête, les autres reculent d'un rang.
  await prisma.$transaction([
    ...(row
      ? [prisma.workoutTemplateExercise.update({ where: { id: row.id }, data })]
      : [prisma.workoutTemplateExercise.updateMany({ where: { templateId: tpl.id }, data: { order: { increment: 1 } } }),
         prisma.workoutTemplateExercise.create({ data: { ...data, templateId: tpl.id, order: 0, loadKg: null } })]),
    prisma.lafayTest.update({ where: { id: t.id }, data: { appliedAt: new Date(), applied: change as unknown as Prisma.InputJsonValue } }),
  ]);
  return change;
}
