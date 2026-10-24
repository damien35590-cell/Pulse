import { dayKey, weekKeys } from "@/lib/dates";

/**
 * Comparaison d'une activité avec les sorties « comparables » de l'utilisateur : même sport, même genre de séance,
 * distance à ±30 %, 90 jours précédents. Fonctions pures (les données arrivent de lib/data/activity-insight.ts).
 */

export type SessionClass = "easy" | "long" | "key";

export type Candidate = {
  id: string;
  type: string;
  startedAt: Date;
  distanceM: number;
  movingTimeS: number;
  avgHr?: number | null;
  rpe?: number | null;
  /** Séance du programme réalisée par cette activité. */
  planned?: { kind: string; isKeySession: boolean } | null;
  race?: boolean;
};

export type ClassContext = { medianDistanceM?: number | null; hrMax?: number | null };

/** Sports où l'allure (s/km) a un sens. */
export const PACE_SPORTS = new Set(["RUN", "WALK", "HIKE"]);
export const WINDOW_DAYS = 90;
export const DISTANCE_TOLERANCE = 0.3;
export const MIN_COMPARABLES = 3;
/** En dessous de cet écart (arrondi), la sortie est « dans la moyenne ». */
export const NEUTRAL_S_KM = 3;

const KEY_KINDS = new Set(["THRESHOLD", "INTERVALS_SHORT", "INTERVALS_LONG", "RACE_PACE", "FARTLEK", "HILLS", "PROGRESSIVE", "VMA_TEST", "RACE"]);
const DAY = 86_400_000;

/**
 * Genre de séance : celui du programme s'il existe, sinon déduit de l'intensité (effort ressenti ≥ 7, FC moyenne ≥ 85 % de la FC max,
 * course) puis de la durée / distance (≥ 1,4 × la distance médiane du sport, ou ≥ 90 min).
 */
export function sessionClass(a: Candidate, ctx: ClassContext = {}): SessionClass {
  const p = a.planned;
  if (p) {
    if (p.isKeySession || KEY_KINDS.has(p.kind)) return "key";
    if (p.kind === "LONG_RUN") return "long";
    if (p.kind === "EASY" || p.kind === "RECOVERY") return "easy";
  }
  if (a.race) return "key";
  if ((a.rpe ?? 0) >= 7) return "key";
  if (a.avgHr && ctx.hrMax && a.avgHr / ctx.hrMax >= 0.85) return "key";
  if ((ctx.medianDistanceM && a.distanceM >= 1.4 * ctx.medianDistanceM) || a.movingTimeS >= 90 * 60) return "long";
  return "easy";
}

export const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const paceSKm = (a: Candidate) => a.movingTimeS / (a.distanceM / 1000);
const usable = (a: Candidate) => a.distanceM >= 500 && a.movingTimeS > 0;

/** Sorties du même sport dans les 90 jours qui précèdent `target` (lui exclu). */
export function recentSameSport(target: Candidate, pool: Candidate[]) {
  const from = +target.startedAt - WINDOW_DAYS * DAY;
  return pool.filter((c) => c.id !== target.id && c.type === target.type && +c.startedAt < +target.startedAt && +c.startedAt >= from);
}

/** Contexte de classement : distance médiane du sport sur la fenêtre (cible comprise). */
export function classContext(target: Candidate, pool: Candidate[], hrMax?: number | null): ClassContext {
  return { medianDistanceM: median([target, ...recentSameSport(target, pool)].filter(usable).map((c) => c.distanceM)), hrMax };
}

/** Comparables : même sport, même genre de séance, distance à ±30 %, 90 jours précédents, activité exclue. */
export function selectComparables(target: Candidate, pool: Candidate[], ctx: ClassContext = {}): Candidate[] {
  if (!usable(target)) return [];
  const kind = sessionClass(target, ctx);
  return recentSameSport(target, pool).filter((c) =>
    usable(c) && Math.abs(c.distanceM - target.distanceM) <= DISTANCE_TOLERANCE * target.distanceM && sessionClass(c, ctx) === kind);
}

const NOUNS: Record<string, Partial<Record<SessionClass, string>> & { all: string }> = {
  RUN: { easy: "footings", long: "sorties longues", key: "séances de qualité", all: "sorties" },
  HIKE: { all: "randos" },
  WALK: { all: "marches" },
};
export const sessionNoun = (type: string, kind: SessionClass) => (NOUNS[type]?.[kind] ?? NOUNS[type]?.all ?? "sorties");

export type PaceInsight = {
  tone: "good" | "warn" | "neutral";
  /** Écart d'allure arrondi en s/km : positif = plus lent. */
  diffS: number;
  /** « 25 s/km plus lent que tes footings similaires » */
  text: string;
  /** « +25 s/km » (pour <Delta>) */
  delta: string;
  /** « Comparé à 5 footings des 90 derniers jours » */
  basis: string;
  count: number;
};

/** Phrase d'écart d'allure : rien sous 3 comparables, « dans ta moyenne » sous 3 s/km d'écart. */
export function paceWording(diff: number, noun: string): Pick<PaceInsight, "tone" | "diffS" | "text" | "delta"> {
  const d = Math.round(diff), abs = Math.abs(d);
  const delta = `${d > 0 ? "+" : d < 0 ? "−" : "±"}${abs} s/km`;
  if (abs < NEUTRAL_S_KM) return { tone: "neutral", diffS: d, text: "Dans ta moyenne habituelle", delta };
  return d > 0
    ? { tone: "warn", diffS: d, text: `${abs} s/km plus lent que tes ${noun} similaires`, delta }
    : { tone: "good", diffS: d, text: `${abs} s/km plus rapide que tes ${noun} similaires`, delta };
}

export function paceInsight(target: Candidate, pool: Candidate[], ctx: ClassContext = {}): PaceInsight | null {
  if (!PACE_SPORTS.has(target.type)) return null;
  const comps = selectComparables(target, pool, ctx);
  if (comps.length < MIN_COMPARABLES) return null;
  const avg = comps.reduce((s, c) => s + paceSKm(c), 0) / comps.length;
  const noun = sessionNoun(target.type, sessionClass(target, ctx));
  return { ...paceWording(paceSKm(target) - avg, noun), basis: `Comparé à ${comps.length} ${noun} des ${WINDOW_DAYS} derniers jours`, count: comps.length };
}

const RECORDS = [["BEST_HALF", "semi-marathon"], ["BEST_10K", "10 km"], ["BEST_5K", "5 km"]] as const;

/**
 * 0 à 2 pastilles de contexte, seulement quand c'est vrai : record détenu par cette activité (records déjà calculés),
 * plus longue sortie du mois (au moins 3 dans le mois), rang dans la semaine (à partir de la 2ᵉ).
 * `pool` doit couvrir le mois et la semaine de l'activité, y compris après elle.
 */
export function contextChips(target: Candidate, pool: Candidate[], o: { tz: string; records?: string[]; ctx?: ClassContext }): string[] {
  const out: string[] = [];
  const rec = RECORDS.find(([k]) => o.records?.includes(k));
  if (rec) out.push(`Record sur ${rec[1]}`);

  const same = [target, ...pool.filter((c) => c.id !== target.id && c.type === target.type)];
  const workout = target.type === "WORKOUT";

  if (!workout && target.distanceM > 0) {
    const month = dayKey(target.startedAt, o.tz).slice(0, 7);
    const easyRun = target.type === "RUN" && sessionClass(target, o.ctx) === "easy";
    const peers = same.filter((c) => dayKey(c.startedAt, o.tz).startsWith(month) && (!easyRun || sessionClass(c, o.ctx) === "easy"));
    if (peers.length >= 3 && peers.every((c) => c.id === target.id || c.distanceM < target.distanceM))
      out.push(easyRun ? "Plus long footing du mois" : "Plus longue sortie du mois");
  }

  const week = new Set(weekKeys(target.startedAt, o.tz));
  const rank = same.filter((c) => week.has(dayKey(c.startedAt, o.tz)) && (+c.startedAt < +target.startedAt || c.id === target.id)).length;
  if (rank >= 2) out.push(`${rank}ᵉ ${workout ? "séance" : "sortie"} de la semaine`);

  return out.slice(0, 2);
}
