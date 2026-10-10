export type Pt = { lat: number; lng: number; t: number }; // t = epoch ms

export function haversine(a: Pt, b: Pt) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** Meilleur temps (secondes) sur `targetM` mètres consécutifs, ou null. */
export function bestEffort(pts: Pt[], targetM: number) {
  if (pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
  if (cum[cum.length - 1] < targetM) return null;
  let best = Infinity, j = 0;
  for (let i = 0; i < pts.length; i++) {
    while (j < pts.length - 1 && cum[j] - cum[i] < targetM) j++;
    if (cum[j] - cum[i] >= targetM) best = Math.min(best, (pts[j].t - pts[i].t) / 1000);
  }
  return Number.isFinite(best) ? best : null;
}
