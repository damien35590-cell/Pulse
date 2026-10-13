export type SeriesPoint = { t: number; power: number; hr?: number }; // t en secondes, un point par seconde
export type Interval = { startTime: number; endTime: number; avgWatts: number; normalizedPower: number; avgHeartRate: number | null };

const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

/** Puissance normalisée : moyenne mobile 30 s, puissance 4, moyenne, racine 4e (au-dessous de 30 s : moyenne simple). */
function normalizedPower(p: number[]) {
  if (p.length < 30) return Math.round(avg(p));
  const pre = [0]; for (const v of p) pre.push(pre[pre.length - 1] + v);
  const r: number[] = []; for (let i = 29; i < p.length; i++) r.push((pre[i + 1] - pre[i - 29]) / 30);
  return Math.round(Math.pow(avg(r.map((x) => x ** 4)), 0.25));
}

/**
 * Isole les blocs continus au-dessus de `thresholdWatts`. La puissance est d'abord lissée (10 s) pour ne pas couper un bloc au moindre creux ;
 * deux blocs séparés de moins de `mergeGapSec` sont fusionnés ; les blocs plus courts que `minSec` sont écartés.
 */
export function detectIntervals(data: SeriesPoint[], thresholdWatts: number, opts: { minSec?: number; mergeGapSec?: number; smoothSec?: number } = {}): Interval[] {
  const { minSec = 60, mergeGapSec = 15, smoothSec = 10 } = opts;
  if (!(thresholdWatts > 0) || data.length < minSec) return [];
  const h = Math.floor(smoothSec / 2), pre = [0]; for (const d of data) pre.push(pre[pre.length - 1] + d.power);
  const sm = data.map((_, i) => { const a = Math.max(0, i - h), b = Math.min(data.length - 1, i + h); return (pre[b + 1] - pre[a]) / (b - a + 1); });
  const runs: [number, number][] = [];
  for (let i = 0; i < data.length; i++) {
    if (sm[i] < thresholdWatts) continue;
    let j = i; while (j + 1 < data.length && sm[j + 1] >= thresholdWatts) j++;
    const last = runs[runs.length - 1];
    if (last && i - last[1] - 1 <= mergeGapSec) last[1] = j; else runs.push([i, j]);
    i = j;
  }
  return runs.filter(([a, b]) => b - a + 1 >= minSec).map(([a, b]) => {
    const slice = data.slice(a, b + 1), hr = slice.map((d) => d.hr ?? 0).filter((v) => v > 0);
    return { startTime: slice[0].t, endTime: slice[slice.length - 1].t, avgWatts: Math.round(avg(slice.map((d) => d.power))), normalizedPower: normalizedPower(slice.map((d) => d.power)), avgHeartRate: hr.length ? Math.round(avg(hr)) : null };
  });
}
