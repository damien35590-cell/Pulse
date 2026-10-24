import type { Split } from "@/components/activity/splits";

export type SplitPoint = { lat: number; lng: number; t: number; hr?: number };

const rad = Math.PI / 180;
const meters = (a: SplitPoint, b: SplitPoint) => {
  const x = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
};
/** Arrêts : un segment de plus de 30 s sur moins de 5 m ne compte pas dans le temps (allure en mouvement, comme movingTimeS). */
const PAUSE_S = 30, PAUSE_M = 5;
/** Dernier bout de parcours gardé s'il fait au moins 200 m (sinon son allure est du bruit). */
const MIN_TAIL_M = 200;

/**
 * Allure par kilomètre à partir de la trace GPS : temps interpolé au passage de chaque km, pauses retirées, FC moyenne du km.
 * Fonction pure (tests : tools/test-splits.ts).
 */
export function kmSplits(points: SplitPoint[]): Split[] {
  const out: Split[] = [];
  let dist = 0, time = 0, kmStartTime = 0, hrSum = 0, hrN = 0;
  const push = (km: number, lenM: number, s: number, label?: string) =>
    out.push({ km, paceS: s / (lenM / 1000), hr: hrN ? Math.round(hrSum / hrN) : undefined, ...(label && { label }) });
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], d = meters(a, b), dt = (b.t - a.t) / 1000;
    if (!(dt > 0) || (dt > PAUSE_S && d < PAUSE_M)) continue;
    if (b.hr) { hrSum += b.hr; hrN++; }
    // Passage d'un (ou plusieurs) km dans ce segment : temps interpolé à la frontière.
    while (dist + d >= (out.length + 1) * 1000) {
      const f = ((out.length + 1) * 1000 - dist) / d, at = time + f * dt;
      push(out.length + 1, 1000, at - kmStartTime);
      kmStartTime = at; hrSum = 0; hrN = 0;
    }
    dist += d; time += dt;
  }
  const tail = dist - out.length * 1000;
  if (tail >= MIN_TAIL_M && time > kmStartTime) push(out.length + 1, tail, time - kmStartTime, (Math.round(tail / 100) / 10).toLocaleString("fr-FR"));
  return out;
}
