/**
 * Estimation du temps d'une boucle selon tes sorties récentes. Fonctions pures (tests : tools/test-routes.ts).
 * Toutes les constantes réglables sont ici.
 */
import { isSoft } from "@/lib/sports";

export type RouteSport = "RUN" | "RIDE";
export type BikeVariant = "road" | "trail";

/** Allure course par défaut : 5'30/km. */
export const DEFAULT_RUN_PACE_S_KM = 330;
/** Vitesse vélo par défaut. */
export const DEFAULT_BIKE_KMH = 22;
/** Course : 100 m de D+ comptent comme 1 km de plat. */
export const RUN_CLIMB_M_PER_KM = 100;
/** Vélo : 6 min de plus par tranche de 100 m de D+. */
export const BIKE_MIN_PER_100M = 6;
/** Vélo sur chemins : plus lent que la vitesse mesurée sur route. */
export const TRAIL_BIKE_FACTOR = 0.8;
/** Fenêtre et filtres des sorties prises en compte. */
export const HISTORY_DAYS = 90;
export const MIN_RUN_KM = 3;
export const MIN_RIDE_KM = 10;
/** En dessous de ce nombre de sorties, on garde la valeur par défaut. */
export const MIN_SAMPLES = 3;
/** Marge acceptée autour du temps visé. */
export const TIME_TOLERANCE = 0.1;

export type HistoryActivity = {
  type: string;
  startedAt: Date;
  distanceM: number;
  movingTimeS: number;
  source?: string | null;
  dedupeKey?: string | null;
  startLat?: number | null;
  title?: string | null;
};

export type Profile = { sport: RouteSport; variant?: BikeVariant; paceSKm: number; speedKmh: number; samples: number };

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const recent = (a: HistoryActivity, now: Date) => +now - +a.startedAt <= HISTORY_DAYS * 864e5 && +a.startedAt <= +now;

/** Vélotaf : E-bike, import Google Fit (vélo à assistance) ou titre explicite. */
export const isCommute = (a: HistoryActivity) =>
  isSoft(a.type) || a.source === "google-fit" || !!a.dedupeKey?.startsWith("gfit-") || /v[ée]lotaf/i.test(a.title ?? "");

/** Allure médiane (s/km) des sorties course de 90 jours, ≥ 3 km, hors activités douces. */
export function runPace(acts: HistoryActivity[], now = new Date()) {
  const paces = acts
    .filter((a) => a.type === "RUN" && !isCommute(a) && recent(a, now) && a.distanceM >= MIN_RUN_KM * 1000 && a.movingTimeS > 0)
    .map((a) => a.movingTimeS / (a.distanceM / 1000))
    .filter((p) => p > 150 && p < 900); // 2'30 à 15'00/km : écarte les traces aberrantes
  return paces.length >= MIN_SAMPLES ? { paceSKm: median(paces)!, samples: paces.length } : { paceSKm: DEFAULT_RUN_PACE_S_KM, samples: 0 };
}

/** Vitesse médiane (km/h) des sorties vélo extérieures de 90 jours, hors vélotaf / vélo électrique / Google Fit / home trainer. */
export function bikeSpeed(acts: HistoryActivity[], now = new Date()) {
  const speeds = acts
    .filter((a) => a.type === "RIDE" && !isCommute(a) && recent(a, now) && a.startLat != null && a.distanceM >= MIN_RIDE_KM * 1000 && a.movingTimeS > 0)
    .map((a) => a.distanceM / 1000 / (a.movingTimeS / 3600))
    .filter((v) => v > 8 && v < 50);
  return speeds.length >= MIN_SAMPLES ? { speedKmh: median(speeds)!, samples: speeds.length } : { speedKmh: DEFAULT_BIKE_KMH, samples: 0 };
}

export function buildProfile(sport: RouteSport, variant: BikeVariant | undefined, acts: HistoryActivity[], now = new Date()): Profile {
  const r = runPace(acts, now), b = bikeSpeed(acts, now);
  return { sport, variant, paceSKm: r.paceSKm, speedKmh: b.speedKmh, samples: sport === "RUN" ? r.samples : b.samples };
}

/** Vitesse vélo effective selon le terrain. */
export const effectiveSpeed = (p: Profile) => p.speedKmh * (p.variant === "trail" ? TRAIL_BIKE_FACTOR : 1);

/** Durée estimée (min). Course : (km + D+/100) × allure. Vélo : km / vitesse + 6 min par 100 m de D+. */
export function estimateMinutes(p: Profile, km: number, ascentM: number) {
  if (p.sport === "RUN") return ((km + ascentM / RUN_CLIMB_M_PER_KM) * p.paceSKm) / 60;
  return (km / effectiveSpeed(p)) * 60 + (ascentM / 100) * BIKE_MIN_PER_100M;
}

/** Distance (km) qui tient dans `minutes`, pour un dénivelé moyen de `climbMPerKm` (m de D+ par km). */
export function kmForMinutes(p: Profile, minutes: number, climbMPerKm = 0) {
  const perKm = estimateMinutes(p, 1, climbMPerKm); // minutes pour 1 km avec son D+
  return minutes / perKm;
}

/** Écart relatif au temps visé : +0,08 = 8 % trop long. */
export const timeError = (estMin: number, target: number) => (estMin - target) / target;
export const withinTolerance = (estMin: number, target: number, tol = TIME_TOLERANCE) => Math.abs(timeError(estMin, target)) <= tol;

/** Dénivelé positif cumulé avec seuil d'hystérésis : ignore le bruit du modèle d'altitude. */
export function ascentOf(elevations: number[], threshold = 4) {
  if (elevations.length < 2) return 0;
  let gain = 0, ref = elevations[0];
  for (const e of elevations) {
    if (e - ref >= threshold) { gain += e - ref; ref = e; }
    else if (ref - e >= threshold) ref = e;
  }
  return Math.round(gain);
}

/** « 5'12/km » */
export const fmtPaceMin = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}'${String(r % 60).padStart(2, "0")}`; };
