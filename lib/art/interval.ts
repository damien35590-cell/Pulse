/**
 * Détection de séance d'intervalles à 10 s de résolution (le ruban de 40 tranches est trop grossier pour des répétitions de 60–120 s).
 * Bloc dur = au moins 30 s de suite en Z4+ ; il compte s'il est suivi de ≥ 20 s en Z1–Z2 (une tranche de transition tolérée) ;
 * séance d'intervalles = au moins 4 blocs qui comptent et 10 à 60 % du temps en Z4+. Fonctions pures (tests : tools/test-zone-ribbon.ts).
 */
import { zoneIndex } from "../zones";

export const SLOT_S = 10;
const MIN_HARD = 3, MIN_RECOVERY = 2, MIN_REPS = 4;
export type IntervalResult = { is: boolean; reps: number };

/** Série à 1 Hz → moyennes sur 10 s des valeurs > 0 (0 = pas de mesure, arrêt). */
export function toSlots(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < series.length; i += SLOT_S) {
    let s = 0, n = 0;
    for (let k = i; k < Math.min(series.length, i + SLOT_S); k++) if (series[k] > 0) { s += series[k]; n++; }
    out.push(n ? s / n : 0);
  }
  return out;
}

/** Détection sur des tranches de 10 s (0 = sans mesure) et les bornes hautes de Z1 à Z5. */
export function detectIntervals(slots: number[], upper: number[]): IntervalResult {
  const z = slots.map((v) => (v > 0 ? zoneIndex(v, upper) : -1));
  const valid = z.filter((x) => x >= 0).length;
  if (!valid) return { is: false, reps: 0 };
  let reps = 0, hard = z.filter((x) => x >= 3).length;
  for (let i = 0; i < z.length; ) {
    if (z[i] < 3) { i++; continue; }
    let j = i;
    while (j < z.length && z[j] >= 3) j++;
    if (j - i >= MIN_HARD) {
      for (const start of [j, j + 1]) {
        let r = start;
        while (r < z.length && z[r] >= 0 && z[r] <= 1) r++;
        if (r - start >= MIN_RECOVERY) { reps++; break; }
      }
    }
    i = j;
  }
  const share = hard / valid;
  return { is: reps >= MIN_REPS && share >= 0.1 && share <= 0.6, reps };
}
