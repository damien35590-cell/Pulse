export type LatLng = [number, number];

export function encodePolyline(pts: LatLng[]) {
  let la = 0, lo = 0, out = "";
  const enc = (v: number) => { v = v < 0 ? ~(v << 1) : v << 1; let o = ""; while (v >= 0x20) { o += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return o + String.fromCharCode(v + 63); };
  for (const [a, b] of pts) { const A = Math.round(a * 1e5), B = Math.round(b * 1e5); out += enc(A - la) + enc(B - lo); la = A; lo = B; }
  return out;
}

export function decodePolyline(s: string): LatLng[] {
  let i = 0, la = 0, lo = 0; const out: LatLng[] = [];
  const next = () => { let r = 0, sh = 0, b: number; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < s.length) { la += next(); lo += next(); out.push([la / 1e5, lo / 1e5]); }
  return out;
}

/** Trace → chemin SVG centré dans w×h (projection corrigée de la latitude). */
export function routePath(poly: string, w: number, h: number, pad = 8) {
  const pts = decodePolyline(poly);
  if (pts.length < 2) return null;
  const k = Math.cos((pts.reduce((s, p) => s + p[0], 0) / pts.length) * Math.PI / 180);
  const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const sc = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1));
  const ox = (w - (x1 - x0) * sc) / 2, oy = (h - (y1 - y0) * sc) / 2;
  const P = pts.map((_, i) => [ox + (xs[i] - x0) * sc, oy + (ys[i] - y0) * sc]);
  return { d: "M" + P.map((p) => p[0].toFixed(1) + "," + p[1].toFixed(1)).join("L"), end: P[P.length - 1] };
}
