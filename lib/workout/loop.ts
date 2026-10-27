/**
 * États de progression affichés sur la page Programme (carte « Progression »), d'après le seul total de répétitions de chaque séance.
 * Fonctions pures (tests : tools/test-loop.ts). Indépendant de la cible proposée en séance (lib/workout/lafay.ts).
 *
 * - progrès : le total a augmenté par rapport à la séance précédente ;
 * - stagne 1/2 : pas de gain une fois ;
 * - stagne 2/2 · boucle : pas de gain deux fois de suite → on repart plus bas (cible de boucle).
 */
export type LoopState = "new" | "progress" | "stall1" | "stall2";

/** Seule une variante différente change l'exercice : on ne compare que les séances de la dernière variante. */
export type TotalPoint = { reps: number; variant: string | null };

export function loopState(points: TotalPoint[]): LoopState {
  if (!points.length) return "new";
  const last = points[points.length - 1].variant;
  const run: number[] = [];
  for (let i = points.length - 1; i >= 0 && points[i].variant === last; i--) run.unshift(points[i].reps);
  if (run.length < 2) return "new";
  let stalls = 0;
  for (let i = run.length - 1; i >= 1 && run[i] <= run[i - 1] && stalls < 2; i--) stalls++;
  return stalls === 0 ? "progress" : stalls === 1 ? "stall1" : "stall2";
}

/** Part retirée aux répétitions pour repartir : 30 % pour les exercices Lafay au poids du corps, 20 % pour les hybrides / haltères et quand le type est inconnu (fourchette de 15 à 20 %). */
export const loopCut = (source: string | null | undefined) => (source === "lafay" ? 0.3 : 0.2);

/** Répétitions par série à la boucle : arrondi à l'inférieur, jamais sous 1. */
export const loopReps = (reps: number, source: string | null | undefined) => Math.max(1, Math.floor(reps * (1 - loopCut(source)) + 1e-9));
