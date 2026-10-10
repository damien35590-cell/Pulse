import type { TrackPoint } from "./types";

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversine(a: TrackPoint, b: TrackPoint): number {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return 0;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function totalDistance(points: TrackPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversine(points[i - 1], points[i]);
  return d;
}

/** Dénivelé positif avec seuil de 3 m pour ignorer le bruit de l'altimètre. */
export function elevationGain(points: TrackPoint[], threshold = 3): number {
  let gain = 0;
  let ref: number | undefined;
  for (const p of points) {
    if (p.ele == null) continue;
    if (ref == null) { ref = p.ele; continue; }
    if (p.ele - ref >= threshold) { gain += p.ele - ref; ref = p.ele; }
    else if (ref - p.ele >= threshold) ref = p.ele;
  }
  return gain;
}

export const dedupeKeyOf = (iso: string) => iso.slice(0, 16); // YYYY-MM-DDTHH:mm
