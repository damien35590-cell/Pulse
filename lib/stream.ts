import type { TrackPoint } from "./import/types";

/** Série à 1 Hz : une valeur par seconde depuis t0 (0 = absence de mesure). */
export type StreamData = { t0: number; n: number; power: number[]; hr: number[]; cad: number[] };
const MAX_N = 36000, FILL = 5; // 10 h max ; trous de capteur comblés jusqu'à 5 s

export function buildStream(points: TrackPoint[]): StreamData | null {
  const pts = points.filter((p) => Number.isFinite(p.t));
  if (pts.length < 10) return null;
  const on = { power: pts.some((p) => (p.power ?? 0) > 0), hr: pts.some((p) => (p.hr ?? 0) > 0), cad: pts.some((p) => (p.cad ?? 0) > 0) };
  if (!on.power && !on.hr) return null;
  const t0 = pts[0].t, n = Math.min(MAX_N, Math.floor((pts[pts.length - 1].t - t0) / 1000) + 1);
  const mk = (enabled: boolean, get: (p: TrackPoint) => number | undefined): number[] => {
    if (!enabled) return [];
    const a = new Array<number>(n).fill(-1);
    for (const p of pts) { const s = Math.round((p.t - t0) / 1000); if (s >= 0 && s < n) a[s] = Math.max(0, Math.round(get(p) ?? 0)); }
    let last = 0, gap = 0;
    for (let i = 0; i < n; i++) { if (a[i] >= 0) { last = a[i]; gap = 0; } else if (++gap <= FILL) a[i] = last; else a[i] = 0; }
    return a;
  };
  return { t0, n, power: mk(on.power, (p) => p.power), hr: mk(on.hr, (p) => p.hr), cad: mk(on.cad, (p) => p.cad) };
}

/** Vérifie une série reçue d'un client avant de l'enregistrer. */
export function sanitizeStream(s: unknown): StreamData | null {
  const x = s as StreamData | null;
  if (!x || !Number.isFinite(x.t0) || !Number.isInteger(x.n) || x.n < 10 || x.n > MAX_N) return null;
  const ok = (a: unknown) => Array.isArray(a) && (a.length === 0 || (a.length === x.n && a.every((v) => Number.isFinite(v))));
  return ok(x.power) && ok(x.hr) && ok(x.cad) ? { t0: x.t0, n: x.n, power: x.power, hr: x.hr, cad: x.cad } : null;
}

export const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
export const meanNonZero = (a: number[]) => mean(a.filter((v) => v > 0));
