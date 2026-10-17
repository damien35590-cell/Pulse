/**
 * Charge d'entraînement d'une activité, sur l'échelle du TSS : une heure à fond au seuil ≈ 100.
 * Méthode retenue, de la plus fiable à la plus approximative :
 *   power    : puissance (vélo) + FTP → TSS = h × IF² × 100, IF = puissance normalisée / FTP
 *   hr       : fréquence cardiaque + FC max → hrTSS (TRIMP de Banister ramené à 100 pour une heure au seuil)
 *   rpe      : effort ressenti → sRPE = RPE × minutes / 4,5 (une heure à RPE 7,5 ≈ 100). Méthode principale en musculation.
 *   estimate : facteur d'intensité par sport × durée
 * Fonctions pures : aucun accès à la base (voir lib/data/load.ts pour l'enregistrement).
 */

/** Facteur d'intensité par sport (estimation) : la charge = heures × IF² × 100. E-bike : l'assistance fait l'essentiel de l'effort. */
export const INTENSITY: Record<string, number> = { RUN: 0.85, RIDE: 0.7, EBIKE: 0.3, HIKE: 0.6, WORKOUT: 0.65, WALK: 0.5, SWIM: 0.75, OTHER: 0.6 };

export type LoadSource = "power" | "hr" | "rpe" | "estimate";
export const LOAD_SOURCES: LoadSource[] = ["power", "hr", "rpe", "estimate"];
export const LOAD_SOURCE_LABELS: Record<LoadSource, string> = { power: "Puissance", hr: "Cardio", rpe: "Ressenti", estimate: "Estimée" };

export type LoadActivity = {
  type: string;
  movingTimeS: number;
  avgHr?: number | null;
  avgPower?: number | null;
  rpe?: number | null;
  /** Série 1 Hz (ActivityStream.data) si disponible. */
  stream?: { power?: number[] | null; hr?: number[] | null } | null;
};
export type LoadZones = { ftp?: number | null; hrMax?: number | null; hrRest?: number | null };
export type LoadResult = { load: number; loadSource: LoadSource };

/** FC de repos par défaut quand elle est inconnue. */
export const DEFAULT_HR_REST = 60;
/** FC au seuil lactique ≈ 88 % de la FC max (fourchette usuelle 85-90 %). */
const LTHR_PCT = 0.88;
/** La puissance n'est comparée qu'à une FTP vélo : course à pied ou autres capteurs exclus. */
const POWER_TYPES = new Set(["RIDE"]);

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Puissance normalisée : moyenne glissante sur 30 s, élevée à la puissance 4, moyennée, puis racine quatrième. */
export function normalizedPower(p: number[]): number | null {
  const W = 30;
  if (p.length < W) return null;
  let s = 0, acc = 0, n = 0;
  for (let i = 0; i < p.length; i++) {
    s += p[i];
    if (i >= W) s -= p[i - W];
    if (i >= W - 1) { acc += (s / W) ** 4; n++; }
  }
  return n ? (acc / n) ** 0.25 : null;
}

/** Poids TRIMP de Banister pour une fraction de FC de réserve (0-1), par minute. */
const trimpWeight = (hrr: number) => hrr * 0.64 * Math.exp(1.92 * hrr);

/** Estimation seule (facteur d'intensité du sport × durée) : aussi le repli de fitnessSeries quand la charge n'est pas encore calculée. */
export const estimateLoad = (a: { type: string; movingTimeS: number }) => (a.movingTimeS / 3600) * (INTENSITY[a.type] ?? 0.6) ** 2 * 100;

function powerLoad(a: LoadActivity, ftp: number): number | null {
  const sp = a.stream?.power ?? [];
  const np = sp.some((v) => v > 0) ? normalizedPower(sp) : null;
  const ref = np ?? ((a.avgPower ?? 0) > 0 ? a.avgPower! : null);
  if (!ref) return null;
  // Avec une série, la durée est celle de la série (définition du TSS) ; sinon la durée en mouvement.
  const s = np ? sp.length : a.movingTimeS;
  return (s / 3600) * (ref / ftp) ** 2 * 100;
}

function hrLoad(a: LoadActivity, hrMax: number, hrRest: number): number | null {
  const range = hrMax - hrRest;
  if (range <= 20) return null;
  const hrr = (hr: number) => Math.min(1, (hr - hrRest) / range);
  // Avec une série, on moyenne le poids seconde par seconde (plus juste sur du fractionné) ; sinon la FC moyenne.
  const sh = (a.stream?.hr ?? []).filter((v) => v > hrRest);
  let w: number;
  if (sh.length >= 60) w = sh.reduce((t, v) => t + trimpWeight(hrr(v)), 0) / sh.length;
  else if ((a.avgHr ?? 0) > hrRest) w = trimpWeight(hrr(a.avgHr!));
  else return null;
  const threshold = trimpWeight(hrr(hrMax * LTHR_PCT));
  return (a.movingTimeS / 3600) * (w / threshold) * 100;
}

const rpeLoad = (a: LoadActivity): number | null =>
  a.rpe != null && a.rpe >= 1 && a.rpe <= 10 ? (a.rpe * (a.movingTimeS / 60)) / 4.5 : null;

/**
 * Charge d'une activité et méthode utilisée.
 * Ordre : puissance → cardio → ressenti → estimation. Musculation : ressenti d'abord (la FC y reflète mal l'effort).
 * E-bike : cardio si disponible, sinon estimation avec un facteur 0,3.
 */
export function computeLoad(a: LoadActivity, zones: LoadZones): LoadResult {
  if (!(a.movingTimeS > 0)) return { load: 0, loadSource: "estimate" };
  const hrRest = zones.hrRest ?? DEFAULT_HR_REST;
  const tryPower = (): LoadResult | null => {
    if (!POWER_TYPES.has(a.type) || !zones.ftp || zones.ftp <= 0) return null;
    const l = powerLoad(a, zones.ftp);
    return l != null ? { load: round1(l), loadSource: "power" } : null;
  };
  const tryHr = (): LoadResult | null => {
    if (!zones.hrMax) return null;
    const l = hrLoad(a, zones.hrMax, hrRest);
    return l != null ? { load: round1(l), loadSource: "hr" } : null;
  };
  const tryRpe = (): LoadResult | null => {
    const l = rpeLoad(a);
    return l != null ? { load: round1(l), loadSource: "rpe" } : null;
  };
  const steps = a.type === "EBIKE" ? [tryHr] : a.type === "WORKOUT" ? [tryRpe, tryPower, tryHr] : [tryPower, tryHr, tryRpe];
  for (const step of steps) { const r = step(); if (r) return r; }
  return { load: round1(estimateLoad(a)), loadSource: "estimate" };
}
