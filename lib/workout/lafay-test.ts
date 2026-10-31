/**
 * Test de niveau Lafay (tome 1 p. 39, tome 2 p. 17) : règles pures, sans base (tests : tools/test-lafay-test.ts).
 * - Ordre : A, B, C, A1, maximum de répétitions en amplitude complète, 3 min de repos entre chaque.
 * - Niveau d'après B : ≤ 4 → niveau 1 programme 1 ; 5 à 7 → niveau 1 programme 2 ; ≥ 8 → niveau 2 (les mêmes seuils que les modèles de catalog-data.ts).
 * - Tome 2 : reps de départ du niveau 2 d'après B (10 à 14 → 6 × 5 … 40 et plus → 6 × 15) ; rien sous 10.
 * Un test n'est pas une séance : il ne crée ni Activity ni WorkoutExercise. Seul « Appliquer » touche au programme, et seulement aux dips.
 */
import type { StrengthRow } from "../analytics/strength-rows";
import { libraryTemplate, structureOf } from "./library";
import { ladderKey } from "./catalog";
import type { Structure } from "./draft";

export const TEST_ORDER = ["A", "B", "C", "A1"] as const;
export type TestCode = (typeof TEST_ORDER)[number];
export type TestResult = Record<TestCode, number>;
export const TEST_REST_S = 180;
export const TEST_INSTRUCTION = "Maximum de répétitions, amplitude complète";
export const TEST_MAX_REPS = 300;
/** Colonne LafayTest de chaque exercice. */
export const TEST_FIELD = { A: "repsA", B: "repsB", C: "repsC", A1: "repsA1" } as const;

export type LevelId = "lafay-n1-p1" | "lafay-n1-p2" | "lafay-n2";
export type Level = { id: LevelId; label: string; rule: string };

/** Niveau conseillé d'après le maximum de dips (B). */
export function levelFromB(b: number): Level {
  if (b <= 4) return { id: "lafay-n1-p1", label: "Niveau 1, programme 1", rule: "0 à 4 dips" };
  if (b <= 7) return { id: "lafay-n1-p2", label: "Niveau 1, programme 2", rule: "5 à 7 dips" };
  return { id: "lafay-n2", label: "Niveau 2", rule: "8 dips et plus" };
}

/** Tableau du tome 2 : B → reps de départ du niveau 2 (6 séries). */
export const TOME2_TABLE: readonly { from: number; reps: number }[] = [
  { from: 40, reps: 15 }, { from: 35, reps: 13 }, { from: 30, reps: 11 }, { from: 25, reps: 10 }, { from: 20, reps: 8 }, { from: 15, reps: 6 }, { from: 10, reps: 5 },
];
/** Départ du niveau 2 lu dans le tableau du tome 2 ; null sous 10 dips (le tableau ne donne rien). */
export function tome2Start(b: number): { sets: 6; reps: number } | null {
  const row = TOME2_TABLE.find((r) => b >= r.from);
  return row ? { sets: 6, reps: row.reps } : null;
}

/** Écart avec le test précédent, exercice par exercice ; null sans test précédent. */
export function deltas(cur: TestResult, prev: TestResult | null): Record<TestCode, number> | null {
  if (!prev) return null;
  return Object.fromEntries(TEST_ORDER.map((c) => [c, cur[c] - prev[c]])) as Record<TestCode, number>;
}
/** Exercices où le test bat le précédent (« Bravo » seulement dans ce cas). */
export const improved = (d: Record<TestCode, number> | null): TestCode[] => (d ? TEST_ORDER.filter((c) => d[c] > 0) : []);

export type DipsTarget = { variant: string | null; sets: number; reps: number; restSec: number; restAfterSec: number; note: string | null };
/**
 * Ce que « Appliquer à mon programme » change : la ligne de dips du modèle « Haut du corps », reprise du modèle du niveau conseillé
 * (catalog-data.ts, converti comme la bibliothèque : structureOf) ; au niveau 2, les reps du tableau du tome 2 quand il en donne.
 * Niveau 1 programme 1 : le modèle n'a pas de dips, rien à appliquer.
 */
export type ApplyPlan =
  | { kind: "none"; level: Level; reason: string }
  | { kind: "dips"; level: Level; after: DipsTarget; repsFrom: "tome2" | "template" | "max" };

export function applyPlan(b: number): ApplyPlan {
  const level = levelFromB(b);
  const t = libraryTemplate(level.id);
  const row = t?.sessions[0]?.exercises.find((x) => x.exerciseId.startsWith("B"));
  if (!t || !row) return { kind: "none", level, reason: `Le ${level.label.toLowerCase()} ne comporte pas de dips (B)` };
  const s: Structure = structureOf(row);
  const table = level.id === "lafay-n2" ? tome2Start(b) : null;
  const after: DipsTarget = { variant: s.variant ?? s.code, sets: table?.sets ?? s.sets, reps: table?.reps ?? s.reps, restSec: s.restSec, restAfterSec: s.restAfterSec, note: s.note };
  return { kind: "dips", level, after, repsFrom: table ? "tome2" : row.reps == null ? "max" : "template" };
}

/** « B1 · 6 × 8 », « B · 3 × max ». */
export const targetText = (t: { variant: string | null; sets: number; reps: number }, max = false) => `${t.variant ?? "B"} · ${t.sets} × ${max ? "max" : t.reps}`;

/**
 * Point de départ posé par un test appliqué : les séances de dips d'avant ne comptent plus pour la cible suivante
 * (sinon applyLafayProgress, qui lit l'historique, écraserait la cible appliquée). Les autres exercices ne bougent pas.
 */
/** Clé d'historique de l'échelle des dips (B1 → B2 → B), la même que groupKey("B1 - dips"). */
export const DIPS_KEY = ladderKey("B");

export function resetDipsHistory(history: Map<string, StrengthRow[]>, appliedAt: Date | null): Map<string, StrengthRow[]> {
  if (!appliedAt) return history;
  const out = new Map(history);
  for (const [k, rows] of history) {
    if (k !== DIPS_KEY && !k.startsWith(`${DIPS_KEY}#`)) continue;
    const kept = rows.filter((r) => r.startedAt >= appliedAt);
    if (kept.length) out.set(k, kept); else out.delete(k);
  }
  return out;
}

/** Corps reçu du téléphone → valeurs propres (entiers de 0 à 300), ou null si une valeur manque. */
export function cleanResult(v: unknown): TestResult | null {
  const out = {} as TestResult;
  for (const c of TEST_ORDER) {
    const n = Math.round(Number((v as Record<string, unknown>)?.[c]));
    if (!Number.isFinite(n) || n < 0 || n > TEST_MAX_REPS) return null;
    out[c] = n;
  }
  return out;
}

/** Ligne LafayTest → résultat. */
export const resultOf = (t: { repsA: number; repsB: number; repsC: number; repsA1: number }): TestResult => ({ A: t.repsA, B: t.repsB, C: t.repsC, A1: t.repsA1 });
