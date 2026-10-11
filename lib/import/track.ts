import type { TrackPoint } from "./types";

export type CompactPoint = { t: number; lat?: number; lng?: number; ele?: number; hr?: number; power?: number; cad?: number };

const mean = (v: (number | undefined)[]) => { const a = v.filter((x): x is number => typeof x === "number" && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : undefined; };

/** Réduit une trace à ~`max` points : moyenne par fenêtre pour cardio/puissance/cadence (les pics ne disparaissent pas), 1er point pour la position. */
export function compactTrack(points: TrackPoint[], max = 900): CompactPoint[] {
  if (!points.length) return [];
  const step = Math.max(1, Math.ceil(points.length / max)), out: CompactPoint[] = [];
  for (let i = 0; i < points.length; i += step) {
    const w = points.slice(i, i + step), p = w[0], o: CompactPoint = { t: p.t };
    if (p.lat != null && p.lng != null) { o.lat = Math.round(p.lat * 1e5) / 1e5; o.lng = Math.round(p.lng * 1e5) / 1e5; }
    if (p.ele != null) o.ele = Math.round(p.ele * 10) / 10;
    const hr = mean(w.map((x) => x.hr)), pw = mean(w.map((x) => x.power)), cad = mean(w.map((x) => x.cad));
    if (hr != null) o.hr = Math.round(hr);
    if (pw != null) o.power = Math.round(pw);
    if (cad != null) o.cad = Math.round(cad);
    out.push(o);
  }
  return out;
}
