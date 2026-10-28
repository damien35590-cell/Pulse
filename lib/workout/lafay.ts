/**
 * Cible de la prochaine séance d'un exercice Lafay, d'après les séances passées. Les états (progrès, stagne 1/2, stagne 2/2) et la cible de boucle
 * viennent de lib/workout/loop.ts, la seule source : la carte « Progression » de la page Programme et la séance proposée par « Démarrer » lisent le même résultat.
 * Fonction pure (tests : tools/test-workout.ts).
 */
import { capOf, entriesOf, isJump, nextVariant, type StrengthRow } from "../analytics/strength-rows";
import { catalogFor, resolveName } from "./catalog";
import { loopReps, loopState, type LoopState } from "./loop";

export type LafayChange = "progress" | "repeat" | "evolve" | "restart";
export type LafayTarget = { variant: string | null; sets: number; reps: number; change: LafayChange; hint: string | null };

/** `rows` : les lignes de CET exercice, de la plus récente à la plus ancienne. `plannedSets` : séries du programme (sinon celles de la dernière séance). Sans historique : target null. */
export function lafayView(rows: StrengthRow[], plannedSets?: number): { state: LoopState; target: LafayTarget | null; loop: string | null } {
  const ents = entriesOf(rows), cur = ents[0];
  if (!cur) return { state: "new", target: null, loop: null };
  const name = rows[0].name, cap = capOf(name), { code } = resolveName(name);
  const source = catalogFor(code, cur.variant)?.source;
  const state = loopState([...ents].reverse().map((e) => ({ reps: e.total, variant: e.variant })));
  const sets = plannedSets ?? cur.sets;
  const stay = (change: LafayChange, reps: number, hint: string | null): LafayTarget => ({ variant: cur.variant, sets, reps, change, hint });
  let target: LafayTarget;

  if (cur.n >= cap && cur.met) {
    // Plafond atteint partout : niveau suivant de l'échelle, avec la cible de boucle.
    const next = nextVariant(cur.variant), reps = loopReps(cur.n, source);
    if (isJump(name)) target = stay("repeat", cur.n, "saute plus haut");
    else if (next) target = { variant: next, sets, reps, change: "evolve", hint: `passe à ${next} à ${sets}×${reps}` };
    else target = stay("repeat", cur.n, "plafond atteint");
  } else if (state === "stall2") {
    // Deux séances de suite sans gain de répétitions : on repart plus bas sur le même niveau.
    const reps = loopReps(cur.n, source);
    target = stay("restart", reps, `repars à ${sets}×${reps}${cur.variant ? ` sur ${cur.variant}` : ""}`);
  } else if (cur.met) target = stay("progress", Math.min(cap, cur.n + 1), null);
  else target = stay("repeat", cur.n, null);

  return { state, target, loop: state === "stall2" && target.change === "restart" ? `${target.sets} × ${target.reps}` : null };
}

export const applyLafayProgress = (rows: StrengthRow[], plannedSets?: number): LafayTarget | null => lafayView(rows, plannedSets).target;
