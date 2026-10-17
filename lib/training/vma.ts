/**
 * VMA courante et estimations (fonctions pures).
 * Ordre : dernière mesure VMA_KMH enregistrée → estimation d'après un chrono → valeur par défaut.
 */
import type { MetricSource } from "@prisma/client";

/** Proposée à la création quand aucune VMA n'est connue. */
export const DEFAULT_VMA = { vmaKmh: 14.5, note: "estimée d'après 44′ sur 10 km il y a un an" } as const;
export const VMA_MIN = 8, VMA_MAX = 25;
export const isValidVma = (v: number) => Number.isFinite(v) && v >= VMA_MIN && v <= VMA_MAX;

/** Demi-Cooper : distance parcourue en 6 minutes à fond. VMA (km/h) = distance (m) / 100. */
export const vmaFromHalfCooper = (distanceM: number) => Math.round((distanceM / 100) * 10) / 10;

/**
 * Part de la VMA tenue sur une course, selon la distance (repères classiques) :
 * 5 km ≈ 95 %, 10 km ≈ 90 %, semi ≈ 85 %, marathon ≈ 80 %. Interpolation linéaire entre ces points.
 */
const RACE_PCT: [number, number][] = [[3000, 0.98], [5000, 0.95], [10000, 0.9], [21097, 0.85], [42195, 0.8]];
export function racePctOfVma(distanceM: number) {
  if (distanceM <= RACE_PCT[0][0]) return RACE_PCT[0][1];
  for (let i = 1; i < RACE_PCT.length; i++) {
    const [d0, p0] = RACE_PCT[i - 1], [d1, p1] = RACE_PCT[i];
    if (distanceM <= d1) return p0 + ((distanceM - d0) / (d1 - d0)) * (p1 - p0);
  }
  return RACE_PCT.at(-1)![1];
}

/**
 * VMA estimée d'après un chrono. Un chrono ancien est minoré (reprise) : rien jusqu'à 2 mois,
 * puis −0,4 % par mois, plafonné à −6 %. Arrondi au demi km/h, l'estimation reste un point de départ.
 */
export function vmaFromRace(distanceM: number, timeS: number, ageDays = 0) {
  const speedKmh = (distanceM / timeS) * 3.6;
  const months = ageDays / 30.4, decay = Math.min(0.06, Math.max(0, months - 2) * 0.004);
  return Math.round(((speedKmh / racePctOfVma(distanceM)) * (1 - decay)) * 2) / 2;
}

export type VmaMetric = { value: number; measuredAt: Date; source: MetricSource };
export type CurrentVma = { vmaKmh: number; source: MetricSource; measuredAt: Date | null; label: string };

const SOURCE_LABEL: Record<MetricSource, string> = { TEST: "test", RACE: "course", ESTIMATED: "estimation", MANUAL: "saisie", INTERVALS: "Intervals.icu" };

/** VMA courante = dernière mesure ; à défaut, estimation d'après un chrono (record 10 km, etc.). */
export function pickVma(metrics: VmaMetric[], race?: { distanceM: number; timeS: number; date: Date } | null, now = new Date()): CurrentVma | null {
  const last = [...metrics].sort((a, b) => +b.measuredAt - +a.measuredAt)[0];
  if (last) return { vmaKmh: last.value, source: last.source, measuredAt: last.measuredAt, label: SOURCE_LABEL[last.source] };
  if (race && race.timeS > 0) {
    const v = vmaFromRace(race.distanceM, race.timeS, (+now - +race.date) / 864e5);
    if (isValidVma(v)) return { vmaKmh: v, source: "ESTIMATED", measuredAt: race.date, label: "estimée d'après ton record" };
  }
  return null;
}
