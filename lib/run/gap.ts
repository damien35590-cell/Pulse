/**
 * Allure ajustée au dénivelé (GAP, « grade-adjusted pace ») : l'allure qu'on tiendrait à effort égal sur du plat.
 * Modèle de coût énergétique de Minetti et al. (2002) : C(i) = 155,4 i⁵ − 30,4 i⁴ − 43,3 i³ + 46,3 i² + 19,5 i + 3,6 (J/kg/m, i = pente en fraction).
 * Une montée coûte plus qu'un plat (facteur > 1) : le temps passé dessus est ramené à du plat en le divisant par ce facteur.
 * Fonctions pures (tests : tools/test-gap.ts). Valeur mémorisée : Activity.gapPaceS (lib/pipeline/post-import.ts).
 */

export type GapPoint = { lat?: number; lng?: number; ele?: number; t: number };

/** La fiche et la comparaison n'ajustent qu'à partir de ce D+ (en dessous, GAP ≈ allure brute). */
export const GAP_MIN_GAIN_M = 50;
/** Pentes bornées : au-delà, la trace est du bruit (GPS, altitude barométrique) ou un mur. */
export const GAP_MAX_GRADE = 0.3;
/** Fenêtre de lissage de l'altitude (m, centrée) : l'altitude GPS saute de plusieurs mètres d'un point à l'autre. */
export const GAP_SMOOTH_M = 100;
/** Demi-base (m) sur laquelle la pente est lue, de part et d'autre du point : une pente sur 10 m seulement n'est que du bruit. */
export const GAP_SLOPE_SPAN_M = 25;
/** Segments sous cette longueur (m) : à l'arrêt ou doublons GPS. */
const MIN_SEG_M = 2;
/** Un segment de plus de 30 s sur moins de 5 m est un arrêt (comme kmSplits). */
const PAUSE_S = 30, PAUSE_M = 5;

const C0 = 3.6;
/** Coût de la course (J/kg/m) à la pente `i` (fraction, bornée à ±GAP_MAX_GRADE). */
export const minettiCost = (i: number) => {
  const g = Math.max(-GAP_MAX_GRADE, Math.min(GAP_MAX_GRADE, i));
  return 155.4 * g ** 5 - 30.4 * g ** 4 - 43.3 * g ** 3 + 46.3 * g ** 2 + 19.5 * g + 3.6;
};
/** Rapport coût à la pente / coût à plat : 1 sur le plat, > 1 en montée, < 1 en descente douce. */
export const gradeFactor = (i: number) => minettiCost(i) / C0;

const rad = Math.PI / 180;
const meters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const x = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
};

/** Moyenne mobile de l'altitude sur une fenêtre de `windowM` mètres de parcours (distances cumulées croissantes). */
export function smoothElevation(cum: number[], ele: number[], windowM = GAP_SMOOTH_M): number[] {
  const out: number[] = [], half = windowM / 2;
  let lo = 0, hi = 0, sum = 0;
  for (let i = 0; i < ele.length; i++) {
    while (hi < ele.length && cum[hi] <= cum[i] + half) sum += ele[hi++];
    while (cum[lo] < cum[i] - half) sum -= ele[lo++];
    out.push(sum / (hi - lo));
  }
  return out;
}

/**
 * Facteur de temps de la trace : Σ(temps / facteur de pente) / Σ temps, pondéré par le temps en mouvement.
 * < 1 sur une trace qui monte (GAP plus rapide que l'allure brute), > 1 si elle descend, 1 à plat. Null sans GPS ni altitude exploitables.
 */
export function gapRatio(points: GapPoint[]): number | null {
  const pts = points.filter((p) => p.lat != null && p.lng != null && p.ele != null && Number.isFinite(p.ele)) as Required<GapPoint>[];
  if (pts.length < 3) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + meters(pts[i - 1], pts[i]));
  if (cum[cum.length - 1] < 200) return null;
  const ele = smoothElevation(cum, pts.map((p) => p.ele));
  // Pente au point i : altitude lissée lue ±GAP_SLOPE_SPAN_M autour de lui (bornes de la trace comprises).
  let a = 0, b = 0;
  const grade = (i: number) => {
    while (cum[a] < cum[i] - GAP_SLOPE_SPAN_M) a++;
    while (b + 1 < pts.length && cum[b + 1] <= cum[i] + GAP_SLOPE_SPAN_M) b++;
    return cum[b] > cum[a] ? (ele[b] - ele[a]) / (cum[b] - cum[a]) : 0;
  };
  let time = 0, flat = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = cum[i] - cum[i - 1], dt = (pts[i].t - pts[i - 1].t) / 1000;
    if (!(dt > 0) || (dt > PAUSE_S && d < PAUSE_M) || d < MIN_SEG_M) continue;
    time += dt;
    flat += dt / gradeFactor(grade(i));
  }
  return time > 0 ? flat / time : null;
}

/** Allure ajustée (s/km) d'une sortie : allure en mouvement × facteur de la trace. Null si la trace ne permet pas le calcul. */
export function gapPace(points: GapPoint[], distanceM: number, movingTimeS: number): number | null {
  const r = gapRatio(points);
  return r != null && distanceM >= 500 && movingTimeS > 0 ? (movingTimeS / (distanceM / 1000)) * r : null;
}

/** GAP à afficher / mémoriser : seulement une sortie avec GPS et au moins GAP_MIN_GAIN_M de D+. */
export const gapIfHilly = (points: GapPoint[], a: { distanceM: number; movingTimeS: number; elevationGainM: number }): number | null =>
  a.elevationGainM >= GAP_MIN_GAIN_M ? gapPace(points, a.distanceM, a.movingTimeS) : null;
