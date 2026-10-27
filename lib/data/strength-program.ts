/**
 * Onglet « Muscu » de la page Programme : prochaine séance (alternance haut / bas), six dernières séances et progression par exercice.
 * Il n'existe pas d'entité « programme muscu » en base : le programme, ce sont les modèles intégrés Haut du corps et Bas + abdos
 * (lib/workout/builtin.ts) et la règle Lafay (lib/workout/lafay.ts). Tout est calculé ici à partir de l'historique.
 */
import { prisma } from "@/lib/prisma";
import { buildStrengthAnalysis, type ExerciseProgress } from "@/lib/analytics/strength";
import { BUILT_IN, builtInStructure, ensureBuiltInTemplates } from "@/lib/workout/builtin";
import { isLafayCode } from "@/lib/workout/catalog";
import { lafayView } from "@/lib/workout/lafay";
import { loopState, type LoopState } from "@/lib/workout/loop";
import type { StrengthRow } from "@/lib/analytics/strength";
import { planExercise } from "@/lib/workout/draft";
import { historyKey, loadHistory } from "@/lib/workout/history";
import { nextKind } from "@/lib/workout/kind";
import { recentSessions } from "@/lib/workout/queries";
import type { DraftExercise, Kind } from "@/lib/workout/types";

const TZ = "Europe/Paris";
/** Fenêtre d'analyse (semaines) : assez longue pour que chaque exercice ait ses 4 dernières séances. */
const WEEKS = 12;
export const RECENT = 6;
export const SPARK = 4;

export type ExerciseState = LoopState;
export type ProgressRow = {
  /** Clé de l'exercice (échelle Lafay), la même que ExerciseProgress.key : relie la carte à l'analyse. */
  key: string;
  /** Séries prévues au programme. */
  sets: number;
  /** « B2 », ou les initiales d'un exercice hors Lafay. */
  code: string;
  name: string;
  /** « 6 × 8 » : séries × répétitions visées à la prochaine séance (règle Lafay). */
  target: string;
  state: ExerciseState;
  /** « 1/2 » ou « 2/2 » quand l'exercice stagne. */
  stall: string | null;
  /** « 6 × 6 » : cible de boucle (« repars à … »), seulement à stagne 2/2. */
  loop: string | null;
  /** Total de répétitions des SPARK dernières séances, du plus ancien au plus récent. */
  spark: number[];
  last: number | null;
};
export type NextPoster = {
  kind: "HAUT" | "BAS";
  /** Séance proposée, telle que l'ouvrira « Démarrer » (?suggest=1). */
  exercises: { code: string; label: string }[];
  sets: number;
  restSec: number;
};
export type StrengthProgramView = {
  hasHistory: boolean;
  lafay: boolean;
  /** Séances faites, de la plus ancienne à la plus récente (au plus RECENT). */
  recent: { id: string; kind: Kind; date: string }[];
  next: NextPoster;
  groups: { kind: "HAUT" | "BAS"; rows: ProgressRow[] }[];
  /** Jour AAAA-MM-JJ de la dernière séance, pour choisir l'onglet par défaut. */
  lastDay: string | null;
};

const label = (e: DraftExercise) => (isLafayCode(e.code) ? e.name.replace(/\s-\s/, " ") : e.name);
/** Phrase : « squat sauté » → « Squat sauté » (jamais de casse de titre en CSS). */
/** « B1 - dips » → « dips » : le code est déjà dans la tuile (affichage seulement, rien n'est modifié en base). */
export const nameOnly = (s: string) => s.replace(/^\s*[A-Za-z]\d{0,2}\s*[-–—:.]\s+/, "").trim();
const upperFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const initials = (name: string) => name.split(/[\s-]+/).filter((w) => w.length > 2).slice(0, 3).map((w) => w[0].toUpperCase()).join("") || name.slice(0, 3).toUpperCase();

function rowOf(e: DraftExercise, p: ExerciseProgress | undefined, rows: StrengthRow[]): ProgressRow {
  // État et cible de boucle : lafayView, comme la séance proposée par « Démarrer » (même historique, même résultat).
  const { state, loop } = isLafayCode(e.code) ? lafayView(rows, e.sets) : { state: p ? loopState(p.points) : ("new" as const), loop: null };
  const totals = p ? p.repsPerSession.slice(-SPARK) : [];
  // Tendance : au moins 2 séances ; avec une seule, on ne montre que le dernier total.
  const spark = totals.length >= 2 ? totals : [];
  return {
    key: historyKey(e.code, e.variant), sets: e.sets,
    code: isLafayCode(e.code) ? (e.variant ?? e.code) : initials(e.name), name: upperFirst(nameOnly(e.name)),
    target: `${e.sets} × ${e.reps}`, state, stall: state === "stall1" ? "1/2" : state === "stall2" ? "2/2" : null, loop,
    spark, last: totals.length ? totals[totals.length - 1] : null,
  };
}

export async function getStrengthProgram(userId: string, now = new Date()): Promise<StrengthProgramView> {
  await ensureBuiltInTemplates(userId);
  const [history, recent, templates] = await Promise.all([
    loadHistory(userId),
    recentSessions(userId, 40),
    prisma.workoutTemplate.findMany({ where: { userId, isBuiltIn: true, kind: { in: ["HAUT", "BAS"] } }, include: { exercises: { orderBy: { order: "asc" } } } }),
  ]);
  const forKind = (kind: "HAUT" | "BAS"): DraftExercise[] => {
    const t = templates.find((x) => x.kind === kind);
    const structure = t
      ? t.exercises.map((e) => ({ code: e.exerciseCode, variant: e.variant, sets: e.sets, reps: e.targetReps, restSec: e.restSec, restAfterSec: e.restAfterSec, loadKg: e.loadKg, note: e.note }))
      : builtInStructure(BUILT_IN.find((b) => b.kind === kind)!.codes, history);
    return structure.map((s) => planExercise(s, history.get(historyKey(s.code, s.variant)) ?? []));
  };
  const drafts = { HAUT: forKind("HAUT"), BAS: forKind("BAS") };

  const progress = new Map(buildStrengthAnalysis([...history.values()].flat(), WEEKS, TZ, now).exercises.map((p) => [p.key, p]));
  const groups = (["HAUT", "BAS"] as const).map((kind) => ({
    kind, rows: drafts[kind].map((e) => rowOf(e, progress.get(historyKey(e.code, e.variant)), history.get(historyKey(e.code, e.variant)) ?? [])),
  }));

  // Même règle que la suggestion du jour (getNextSessionSuggestion) : alternance d'après la dernière séance haut / bas.
  const nk = nextKind(recent.find((r) => r.kind !== "LIBRE")?.kind ?? null), next = drafts[nk];
  const lafay = next.length > 0 && next.every((e) => isLafayCode(e.code));
  return {
    hasHistory: recent.length > 0, lafay,
    recent: recent.slice(0, RECENT).reverse().map((r) => ({ id: r.id, kind: r.kind, date: r.date })),
    next: { kind: nk, exercises: next.map((e) => ({ code: isLafayCode(e.code) ? (e.variant ?? e.code) : initials(e.name), label: label(e) })), sets: next[0]?.sets ?? 0, restSec: next[0]?.restSec ?? 0 },
    groups, lastDay: recent[0]?.date.slice(0, 10) ?? null,
  };
}
