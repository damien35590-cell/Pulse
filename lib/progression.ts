/** Double progression : objectif du jour d'un exercice d'après ses dernières séances. Sans dépendance, testable seul. */
import type { Past } from "./exercises";

export type Goal = { sets: number; reps: number; loadKg: number | null; text: string; hint?: string };
const kg = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
export const describe = (p: { sets: number; reps: number; loadKg: number | null }) => `${p.sets} × ${p.reps}${p.loadKg != null ? ` à ${kg(p.loadKg)} kg` : ""}`;

/** Séance réussie : toutes les séries prévues faites avec au moins les reps prévues. Sans détail série par série, on suppose le prévu réalisé. */
export const succeeded = (p: Past) => !p.setsDetail || (p.setsDetail.length >= p.sets && p.setsDetail.every((s) => s.done && s.reps >= p.reps));

/** Séances réussies d'affilée, de la plus récente à la plus ancienne. */
export const streakOf = (sessions: Past[]) => { let n = 0; while (n < sessions.length && succeeded(sessions[n])) n++; return n; };

/**
 * - échec la dernière fois → même objectif ;
 * - charge : +1 rep par série, ou +2,5 kg une fois à 12 reps ou plus ;
 * - poids de corps : +1 rep, et au-delà de 3 séances réussies d'affilée « Passe à la variante plus difficile ».
 */
export function suggestGoal(sessions: Past[]): Goal | null {
  const last = sessions[0];
  if (!last) return null;
  const { sets, reps, loadKg } = last;
  if (!succeeded(last)) return { sets, reps, loadKg, text: describe(last), hint: "Série ratée la dernière fois : même objectif" };
  if (loadKg == null) return { sets, reps: reps + 1, loadKg, text: describe({ sets, reps: reps + 1, loadKg }), hint: streakOf(sessions) > 3 ? "Passe à la variante plus difficile" : undefined };
  if (reps >= 12) return { sets, reps, loadKg: loadKg + 2.5, text: describe({ sets, reps, loadKg: loadKg + 2.5 }) };
  return { sets, reps: reps + 1, loadKg, text: describe({ sets, reps: reps + 1, loadKg }) };
}
