/**
 * Assemble un brouillon de séance : une structure (exercices, séries, repos) + l'historique → cibles du jour et « dernière fois ».
 * Pure, sans base de données (tests : tools/test-workout.ts) ; les lectures Prisma sont dans queries.ts.
 */
import { doneSets, sumReps, variantOf, type StrengthRow } from "../analytics/strength";
import { suggestGoal } from "../progression";
import type { Past } from "../exercises";
import { defaultVariant, displayName, isLafayCode } from "./catalog";
import { applyLafayProgress } from "./lafay";
import type { DraftExercise, LastTime } from "./types";

/** Ce qu'un modèle ou une séance passée décrit d'un exercice : la structure, jamais les performances. */
export type Structure = { code: string; variant: string | null; sets: number; reps: number; restSec: number; restAfterSec: number; loadKg: number | null; note: string | null;
  /** Niveau choisi à la main dans l’éditeur de modèle (WorkoutTemplateExercise.variantSetAt) ; absent pour une séance passée. */
  variantSetAt?: Date | null };

let seq = 0;
const uid = () => `x${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Les séries de la séance la plus récente de l'historique (un exercice peut y figurer sur plusieurs lignes). */
function lastTime(history: StrengthRow[]): LastTime | null {
  const first = history[0];
  if (!first) return null;
  const sameDay = history.filter((r) => r.activityId === first.activityId);
  const sets = sameDay.flatMap((r) => doneSets(r));
  if (!sets.length) return null;
  return { date: first.startedAt.toISOString(), variant: variantOf(first.name), reps: sets.map((s) => s.reps), total: sumReps(sets), loadKg: sets[sets.length - 1].loadKg };
}

/**
 * `history` : les lignes de cet exercice, de la plus récente à la plus ancienne.
 * Lafay → applyLafayProgress (variante et reps cibles). Autre exercice → double progression (lib/progression.ts).
 * Sans historique, la structure fait foi.
 */
export function planExercise(s: Structure, history: StrengthRow[]): DraftExercise {
  const last = lastTime(history);
  const base = { id: uid(), code: s.code, sets: s.sets, restSec: s.restSec, restAfterSec: s.restAfterSec, note: s.note, last };

  if (isLafayCode(s.code)) {
    // Niveau choisi à la main dans le modèle, pas encore pratiqué depuis : il prime sur l’historique, qui repart des reps du modèle.
    // Dès qu’une séance de l’échelle est plus récente que le choix, l’historique reprend la main (comme avant).
    const picked = !!s.variantSetAt && !!s.variant && !!history[0] && history[0].startedAt < s.variantSetAt && applyLafayProgress(history)?.variant !== s.variant;
    const p = picked ? null : applyLafayProgress(history);
    const variant = p ? p.variant : s.variant ?? defaultVariant(s.code);
    const reps = p?.reps ?? s.reps;
    // Le conseil parle des séries proposées ici (celles du modèle), pas de celles de la dernière séance.
    const hint = picked ? `niveau choisi : ${variant} à ${s.sets}×${s.reps}` : p?.change === "evolve" ? `passe à ${variant} : ${s.sets}×${reps}` : p?.change === "restart" ? `repars à ${s.sets}×${reps}${variant ? ` en ${variant}` : ""}` : p?.hint ?? null;
    // De quoi rejouer la même règle en fin d'exercice, sur le téléphone (verdict « prochaine fois »).
    const past = history.slice(0, 6).map((r) => ({ activityId: r.activityId, name: r.name, sets: r.sets, reps: r.reps, setsDetail: r.setsDetail?.map((d) => ({ reps: d.reps, done: d.done !== false && !(d as { isWarmup?: boolean }).isWarmup })) ?? null }));
    return { ...base, variant, name: displayName(s.code, variant), reps, loadKg: s.loadKg, hint, ...(past.length ? { past } : {}) };
  }

  const past: Past[] = history.slice(0, 4).map((r) => ({ date: r.startedAt.toISOString(), sets: r.sets, reps: r.reps, loadKg: r.loadKg, restS: null, setsDetail: r.setsDetail }));
  const g = suggestGoal(past);
  return { ...base, variant: null, name: s.code, reps: g?.reps ?? s.reps, loadKg: g ? g.loadKg : s.loadKg, hint: g?.hint ?? null };
}
