/** Brouillon ↔ SetLogger ↔ API : conversions pures (tests : tools/test-workout.ts). */
import type { LiftExercise } from "@/components/workout/set-logger";
import type { DraftExercise } from "./types";

/** Un exercice du brouillon prêt pour le SetLogger : cibles, repos, et « précédent » série par série. Sans charge = poids du corps (la charge devient un lest). */
export function toLift(d: DraftExercise): LiftExercise {
  const bodyweight = d.loadKg == null;
  return {
    name: d.name, sets: d.sets, reps: d.reps, kg: d.loadKg ?? 0, step: bodyweight ? 1 : 2.5,
    restS: d.restSec, restAfterS: d.restAfterSec, bodyweight,
    prev: (d.last?.reps ?? []).map((reps) => ({ reps, kg: d.last?.loadKg ?? 0 })),
    done: [],
  };
}

/** Un exercice fait → ligne de POST /api/activities : le prévu (sets, reps, charge, repos) et le réel série par série. */
export function toPayload(e: LiftExercise) {
  const load = (kg: number) => (e.bodyweight && !kg ? null : kg);
  return { name: e.name, sets: e.sets, reps: e.reps, loadKg: load(e.kg), restS: e.restS, setsDetail: e.done.map((d) => ({ reps: d.reps, loadKg: load(d.kg), done: true })) };
}

/** Titre par défaut d'une séance libre, comme l'ancien écran : « Musculation du matin ». */
export function freeTitle(at: Date) {
  const h = at.getHours();
  return `Musculation ${h < 12 ? "du matin" : h < 18 ? "de l’après-midi" : "du soir"}`;
}
