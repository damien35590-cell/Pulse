import { decodePolyline, type LatLng } from "@/lib/polyline";

/** Taille d'une tuile (px CSS). */
export const TILE = 256;

/** Web Mercator : position en px du monde au zoom z (x vers l'est, y vers le sud). */
export function project([lat, lng]: LatLng, z: number): [number, number] {
  const s = TILE * 2 ** z, sin = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return [((lng + 180) / 360) * s, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s];
}

/** Distance² d'un point au segment [a, b] (plan local, longitude corrigée par k = cos(lat)). */
function segDist2(p: LatLng, a: LatLng, b: LatLng, k: number) {
  const px = p[1] * k, py = p[0], ax = a[1] * k, ay = a[0], bx = b[1] * k, by = b[0];
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  const x = ax + t * dx - px, y = ay + t * dy - py;
  return x * x + y * y;
}

/** Douglas-Peucker itératif : indices gardés pour une tolérance donnée. */
function dp(pts: LatLng[], tol2: number, k: number) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = 0, at = -1;
    for (let i = a + 1; i < b; i++) { const d = segDist2(pts[i], pts[a], pts[b], k); if (d > best) { best = d; at = i; } }
    if (at > 0 && best > tol2) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return keep;
}

/**
 * Trace simplifiée à `max` points environ (Douglas-Peucker) : la tolérance est cherchée par dichotomie
 * pour garder le plus de détail possible sous la limite. Coordonnées arrondies à 1e-5 (≈ 1 m).
 */
export function simplifyTrack(pts: LatLng[], max = 200): LatLng[] {
  const round = (p: LatLng): LatLng => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
  if (pts.length <= max) return pts.map(round);
  const k = Math.cos((pts[0][0] * Math.PI) / 180);
  // Tolérance au carré, en degrés² : 1e-10 ≈ 1 m d'écart.
  let lo = 0, hi = 1e-10, keep = dp(pts, hi, k);
  while (keep.reduce((s, v) => s + v, 0) > max) { lo = hi; hi *= 4; keep = dp(pts, hi, k); }
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2, next = dp(pts, mid, k);
    if (next.reduce((s, v) => s + v, 0) > max) lo = mid; else { hi = mid; keep = next; }
  }
  return pts.filter((_, i) => keep[i]).map(round);
}

/** Trace prête pour la vignette du fil (côté serveur) : null sans GPS (intérieur, muscu). */
export function previewTrack(polyline: string | null | undefined, max = 200): LatLng[] | undefined {
  if (!polyline) return undefined;
  const pts = decodePolyline(polyline);
  return pts.length > 1 ? simplifyTrack(pts, max) : undefined;
}
