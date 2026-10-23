/**
 * Cible de la prochaine séance d'un exercice Lafay, d'après les séances passées. Réutilise les règles de l'analyse
 * (lib/analytics/strength.ts) : progrès = toutes les séries à la cible, blocage = 2 séances sans progrès, plafond de 12 reps (20 au squat sauté).
 * Fonction pure (tests : tools/test-workout.ts).
 */
import { advice, capOf, entriesOf, isJump, stallsOf, type StrengthRow } from "../analytics/strength";

export type LafayChange = "progress" | "repeat" | "evolve" | "restart";
export type LafayTarget = { variant: string | null; sets: number; reps: number; change: LafayChange; hint: string | null };

/**
 * `rows` : les lignes de CET exercice (même lettre), de la plus récente à la plus ancienne. Renvoie null sans historique.
 *
 * - toutes les séries à la cible → +1 rep par série ;
 * - cible atteinte partout au plafond, ou 2 séances sans progrès → variante suivante à 70 % du plafond (même niveau à 70 % s'il n'y en a pas) ;
 * - sinon → même cible (réessayer).
 * Contrairement à l'écran Analyse, un plafond non atteint partout ne change pas de niveau : on réessaie d'abord.
 */
export function applyLafayProgress(rows: StrengthRow[]): LafayTarget | null {
  const ents = entriesOf(rows), cur = ents[0];
  if (!cur) return null;
  const name = rows[0].name, cap = capOf(name), stalls = stallsOf(ents);
  const stay = (change: LafayChange, reps: number, hint: string | null): LafayTarget => ({ variant: cur.variant, sets: cur.sets, reps, change, hint });

  if ((cur.n >= cap && cur.met) || stalls >= 2) {
    if (isJump(name) && cur.n >= cap) return stay("repeat", cur.n, "saute plus haut");
    const adv = advice(cur, name);
    if (adv.next) return { variant: adv.next, sets: cur.sets, reps: adv.restart, change: "evolve", hint: adv.hint };
    if (stalls >= 2) return stay("restart", adv.restart, adv.hint);
    return stay("repeat", cur.n, "plafond atteint");
  }
  if (cur.met) return stay("progress", Math.min(cap, cur.n + 1), null);
  return stay("repeat", cur.n, null);
}
