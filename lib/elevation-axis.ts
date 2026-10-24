import { fmtNum } from "@/lib/format";

/** Pas « rond » (1, 2, 2,5 ou 5 × 10ⁿ) au moins égal à `raw`. */
export function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw));
  return ([1, 2, 2.5, 5, 10].find((k) => k * p >= raw) ?? 10) * p;
}

/** Pas rond immédiatement inférieur (5 → 2,5 → 2 → 1 → 0,5…). */
function stepBelow(s: number) {
  const p = 10 ** Math.floor(Math.log10(s) + 1e-9), k = Math.round((s / p) * 10) / 10;
  return (k > 5 ? 5 : k > 2.5 ? 2.5 : k > 2 ? 2 : k > 1 ? 1 : 0.5) * p;
}

/** 3 graduations rondes, et l'axe qui les contient (jamais depuis 0, ~10 % de marge en haut). */
export function elevationAxis(min: number, max: number) {
  const r = max - min || 10, top = max + r * 0.1;
  // D'abord 3 valeurs qui encadrent les données (1 020 → 1 890 m : 1 000 / 1 500 / 2 000)…
  let step = niceStep(r / 2), t0 = Math.floor(min / step) * step;
  while (t0 + 2 * step < max) { step = niceStep(step * 1.001); t0 = Math.floor(min / step) * step; }
  // …sauf si l'axe s'en trouve trop étiré (412 → 1 287 m donnerait 0 → 2 000) : 3 valeurs à l'intérieur (500 / 750 / 1 000).
  if (2 * step > 1.5 * r) {
    step = niceStep(r / 2);
    for (let i = 0; i < 20 && (t0 = Math.ceil(min / step) * step) + 2 * step > top; i++) step = stepBelow(step);
  }
  const ticks = [t0, t0 + step, t0 + 2 * step];
  const lo = Math.min(t0, min - r * 0.05), hi = Math.max(ticks[2], max + r * 0.1), pad = (hi - lo) * 0.06; // les étiquettes extrêmes restent dans le cadre
  return { ticks, domain: [lo - pad, hi + pad] as [number, number] };
}

/** Un repère par km (2 km au-delà de 12 km, 5 km au-delà de 30 km, 500 m sous 2 km) ; « km » sur le dernier seulement. */
export function distanceTicks(total: number): { at: number; label: string }[] {
  if (total <= 0) return [];
  const step = total > 30 ? 5 : total > 12 ? 2 : total < 2 ? 0.5 : 1, out: { at: number; label: string }[] = [];
  for (let k = 0; k * step <= total + 1e-9; k++) out.push({ at: (k * step) / total, label: fmtNum(k * step, 1) });
  out[out.length - 1].label += " km";
  return out;
}

/** D+ / D− avec un seuil de 3 m : le bruit du GPS ou du baromètre ne s'additionne pas. */
export function climb(ele: number[]) {
  let up = 0, down = 0, ref = ele[0];
  for (const e of ele) {
    if (e - ref >= 3) { up += e - ref; ref = e; } else if (ref - e >= 3) { down += ref - e; ref = e; }
  }
  return { up, down };
}

/** Écart vertical minimal du profil (m) : un parcours plat reste plat au lieu d'amplifier 5 m de bruit sur toute la hauteur. */
export const MIN_ELEVATION_SPAN = 40;

/** Bornes élargies à `span` mètres au moins, centrées sur les données. */
export function spanAtLeast(min: number, max: number, span = MIN_ELEVATION_SPAN): [number, number] {
  if (max - min >= span) return [min, max];
  const mid = (min + max) / 2;
  return [mid - span / 2, mid + span / 2];
}
