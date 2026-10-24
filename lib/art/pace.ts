/**
 * Allure d'une course d'après sa trace GPS, pour le ruban de zones quand il n'y a pas de FC (logique Campus Coach : zones en % de la VMA).
 * Fonctions pures (tests : tools/test-zone-ribbon.ts).
 */
import { haversine } from "../geo";

/** Bornes hautes de Z1 à Z5 en % de la VMA (Z6 = au-delà) : Z1 < 60, Z2 60–75, Z3 75–85, Z4 85–92, Z5 92–100, Z6 > 100. */
export const PACE_PCT = [60, 75, 85, 92, 100];
/** En dessous : arrêt (feu, ravito), ignoré plutôt que compté comme une allure lente. */
export const STOP_KMH = 1;
/** Au-dessus : saut GPS, pas une vitesse de course. */
const MAX_KMH = 40;
/** Lissage de la vitesse (s), centré. */
export const SMOOTH_S = 30;
const MIN_GAP_S = 30;
const MAX_SERIES = 36000; // 10 h, comme lib/stream.ts

export type PacePoint = { t: number; lat?: number; lng?: number };

/**
 * Vitesse (km/h) à chaque seconde, 0 = arrêt ou trou. Vitesse d'un tronçon = distance GPS / durée entre deux points (la trace compactée
 * garde un point toutes les quelques secondes), lissée sur ~30 s en ne comptant que les secondes en mouvement. Une pause de montre
 * (trou bien plus long que l'échantillonnage) ne donne aucune vitesse.
 */
export function paceSeries(points: PacePoint[]): number[] {
  const pts = points.filter((p) => Number.isFinite(p.t) && p.lat != null && p.lng != null).sort((a, b) => a.t - b.t);
  if (pts.length < 2) return [];
  const dts = pts.slice(1).map((p, i) => p.t - pts[i].t).filter((d) => d > 0).sort((a, b) => a - b);
  if (!dts.length) return [];
  const maxGapMs = Math.max(MIN_GAP_S * 1000, 4 * dts[Math.floor(dts.length / 2)]);

  const t0 = pts[0].t, n = Math.min(MAX_SERIES, Math.floor((pts[pts.length - 1].t - t0) / 1000) + 1);
  const raw = new Array<number>(n).fill(0);
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k], dt = b.t - a.t;
    if (dt <= 0 || dt > maxGapMs) continue;
    const kmh = (haversine({ lat: a.lat!, lng: a.lng!, t: a.t }, { lat: b.lat!, lng: b.lng!, t: b.t }) / (dt / 1000)) * 3.6;
    if (kmh < STOP_KMH || kmh > MAX_KMH) continue;
    for (let s = Math.round((a.t - t0) / 1000), end = Math.min(n, Math.round((b.t - t0) / 1000)); s < end; s++) raw[s] = kmh;
  }

  // Moyenne centrée sur les seules secondes en mouvement ; une seconde à l'arrêt reste à 0.
  const sum = new Array<number>(n + 1).fill(0), cnt = new Array<number>(n + 1).fill(0);
  for (let i = 0; i < n; i++) { sum[i + 1] = sum[i] + raw[i]; cnt[i + 1] = cnt[i] + (raw[i] > 0 ? 1 : 0); }
  const half = SMOOTH_S / 2;
  return raw.map((v, i) => {
    if (v <= 0) return 0;
    const from = Math.max(0, i - half), to = Math.min(n, i + half + 1);
    return (sum[to] - sum[from]) / (cnt[to] - cnt[from]);
  });
}
