export const DURATIONS = [5, 30, 60, 300, 1200, 3600]; // secondes
export const DURATION_LABELS = ["5 s", "30 s", "1 min", "5 min", "20 min", "1 h"];

/** Meilleure puissance moyenne sur d secondes consécutives (fenêtre glissante), ou null si la séance est plus courte. */
export function meanMax(p: number[], d: number): number | null {
  if (p.length < d || d < 1) return null;
  let s = 0;
  for (let i = 0; i < d; i++) s += p[i];
  let best = s;
  for (let i = d; i < p.length; i++) { s += p[i] - p[i - d]; if (s > best) best = s; }
  return Math.round(best / d);
}
export const powerCurve = (p: number[]) => DURATIONS.map((d) => meanMax(p, d));

/** FTP estimée : 95 % de la meilleure puissance sur 20 min, à défaut la puissance sur 1 h. Sinon null (pas assez de données). */
export function estimateFtp(curve: (number | null)[]): number | null {
  if (curve[4]) return Math.round(curve[4]! * 0.95);
  if (curve[5]) return curve[5]!;
  return null;
}
/** Meilleure valeur par durée sur plusieurs courbes. */
export const bestCurve = (curves: ((number | null)[] | null | undefined)[]) =>
  DURATIONS.map((_, i) => { const v = curves.map((c) => c?.[i] ?? 0).reduce((m, x) => Math.max(m, x), 0); return v > 0 ? v : null; });
