import { dayKey } from "./dates";
import { shiftDay } from "./dates";

export type Discipline = "RIDE" | "RUN" | "HIKE" | "WORKOUT";
export type BadgeIcon = "foot" | "flag" | "mountain" | "flame" | "clock" | "route" | "bike" | "dumbbell" | "zap" | "calendar" | "repeat";

export const DISCIPLINES: Discipline[] = ["RIDE", "RUN", "HIKE", "WORKOUT"];

export type DisciplineStats = {
  count: number; km: number; elevation: number; hours: number;
  maxKm: number; maxHours: number; maxAvgPower: number;
  weekStreak: number; reps: number; tonnes: number;
};
export type BadgeStats = Record<Discipline, DisciplineStats>;

export type BadgeDef = {
  id: string; discipline: Discipline; name: string; desc: string; icon: BadgeIcon;
  unit: string; decimals?: number; tiers: [number, number, number];
  value: (s: DisciplineStats) => number;
};

/** Badges calculés à la volée : rien à synchroniser, rien à semer en base. Seuils modifiables ici. */
export const BADGES: BadgeDef[] = [
  // ───── Vélo ─────
  { id: "ride-count", discipline: "RIDE", name: "Pédaleur", desc: "Sorties à vélo enregistrées.", icon: "bike", unit: "sorties", tiers: [1, 25, 100], value: (s) => s.count },
  { id: "ride-km", discipline: "RIDE", name: "Tour de Bretagne", desc: "Kilomètres cumulés à vélo.", icon: "route", unit: "km", tiers: [500, 1500, 3000], value: (s) => s.km },
  { id: "ride-elev", discipline: "RIDE", name: "Grimpeur", desc: "Dénivelé cumulé à vélo (jusqu’à l’Everest).", icon: "mountain", unit: "m", tiers: [1000, 5000, 8849], value: (s) => s.elevation },
  { id: "ride-long", discipline: "RIDE", name: "Sortie fleuve", desc: "Votre plus longue sortie à vélo.", icon: "flag", unit: "km", tiers: [50, 100, 150], value: (s) => s.maxKm },
  { id: "ride-power", discipline: "RIDE", name: "Watt mérité", desc: "Meilleure puissance moyenne sur une séance.", icon: "zap", unit: "W", tiers: [150, 200, 250], value: (s) => s.maxAvgPower },
  { id: "ride-weeks", discipline: "RIDE", name: "Régulier", desc: "Semaines d’affilée avec au moins une sortie.", icon: "calendar", unit: "semaines", tiers: [4, 12, 26], value: (s) => s.weekStreak },
  // ───── Course ─────
  { id: "run-count", discipline: "RUN", name: "Première foulée", desc: "Sorties de course enregistrées.", icon: "foot", unit: "sorties", tiers: [1, 25, 100], value: (s) => s.count },
  { id: "run-long", discipline: "RUN", name: "Cinq, dix, semi", desc: "Votre plus longue course d’une traite.", icon: "flag", unit: "km", decimals: 1, tiers: [5, 10, 21.0975], value: (s) => s.maxKm },
  { id: "run-km", discipline: "RUN", name: "Kilomètres au compteur", desc: "Kilomètres cumulés en course à pied.", icon: "route", unit: "km", tiers: [100, 500, 1000], value: (s) => s.km },
  { id: "run-weeks", discipline: "RUN", name: "Régulier", desc: "Semaines d’affilée avec au moins une sortie.", icon: "calendar", unit: "semaines", tiers: [4, 12, 26], value: (s) => s.weekStreak },
  // ───── Randonnée ─────
  { id: "hike-count", discipline: "HIKE", name: "Marcheur des cimes", desc: "Randonnées enregistrées.", icon: "mountain", unit: "randos", tiers: [1, 10, 30], value: (s) => s.count },
  { id: "hike-elev", discipline: "HIKE", name: "Montagnard", desc: "Dénivelé cumulé en randonnée.", icon: "mountain", unit: "m", tiers: [1000, 5000, 10000], value: (s) => s.elevation },
  { id: "hike-time", discipline: "HIKE", name: "Journée entière", desc: "Votre plus longue randonnée en temps de marche.", icon: "clock", unit: "h", decimals: 1, tiers: [4, 6, 8], value: (s) => s.maxHours },
  { id: "hike-km", discipline: "HIKE", name: "Sur les sentiers", desc: "Kilomètres cumulés en randonnée.", icon: "route", unit: "km", tiers: [50, 200, 500], value: (s) => s.km },
  // ───── Musculation ─────
  { id: "wo-count", discipline: "WORKOUT", name: "Séance après séance", desc: "Séances de musculation enregistrées.", icon: "dumbbell", unit: "séances", tiers: [1, 25, 100], value: (s) => s.count },
  { id: "wo-weeks", discipline: "WORKOUT", name: "Régulier", desc: "Semaines d’affilée avec au moins une séance.", icon: "calendar", unit: "semaines", tiers: [4, 12, 26], value: (s) => s.weekStreak },
  { id: "wo-reps", discipline: "WORKOUT", name: "Mille et une reps", desc: "Répétitions cumulées (poids de corps compris).", icon: "repeat", unit: "reps", tiers: [500, 2500, 10000], value: (s) => s.reps },
  { id: "wo-tonnes", discipline: "WORKOUT", name: "Poids lourd", desc: "Tonnes soulevées au total (exercices avec charge).", icon: "flame", unit: "t", decimals: 1, tiers: [1, 10, 50], value: (s) => s.tonnes },
];

/** Version sérialisable (aucune fonction), prête à passer à un composant client. */
export type EvaluatedBadge = {
  id: string; discipline: Discipline; name: string; desc: string; icon: BadgeIcon; unit: string; decimals: number;
  value: number; tier: number; next: number | null; progress: number;
};

export function evaluateBadges(stats: BadgeStats): EvaluatedBadge[] {
  return BADGES.map((b) => {
    const value = b.value(stats[b.discipline]);
    const tier = b.tiers.filter((t) => value >= t).length;
    const next = b.tiers[tier] ?? null;
    return {
      id: b.id, discipline: b.discipline, name: b.name, desc: b.desc, icon: b.icon, unit: b.unit, decimals: b.decimals ?? 0,
      value, tier, next, progress: next ? Math.min(value / next, 1) : 1,
    };
  });
}

type ActRow = { type: string; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; avgPower: number | null };
type ExRow = { sets: number; reps: number; loadKg: number | null };

const empty = (): DisciplineStats => ({ count: 0, km: 0, elevation: 0, hours: 0, maxKm: 0, maxHours: 0, maxAvgPower: 0, weekStreak: 0, reps: 0, tonnes: 0 });

/** Numéro de semaine (lundi → dimanche) à partir d'une clé jour YYYY-MM-DD. */
const weekOf = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) / 86400000 + 3) / 7);
};

function bestConsecutive(set: Set<number>) {
  let best = 0;
  for (const w of set) {
    if (set.has(w - 1)) continue;
    let n = 0, c = w;
    while (set.has(c)) { n++; c++; }
    best = Math.max(best, n);
  }
  return best;
}

export function buildBadgeStats(acts: ActRow[], exercises: ExRow[], tz: string): BadgeStats {
  const stats: BadgeStats = { RIDE: empty(), RUN: empty(), HIKE: empty(), WORKOUT: empty() };
  const weeks: Record<Discipline, Set<number>> = { RIDE: new Set(), RUN: new Set(), HIKE: new Set(), WORKOUT: new Set() };

  for (const a of acts) {
    if (!DISCIPLINES.includes(a.type as Discipline)) continue;
    const d = a.type as Discipline;
    const s = stats[d];
    const km = a.distanceM / 1000, h = a.movingTimeS / 3600;
    s.count++; s.km += km; s.elevation += a.elevationGainM; s.hours += h;
    s.maxKm = Math.max(s.maxKm, km);
    s.maxHours = Math.max(s.maxHours, h);
    s.maxAvgPower = Math.max(s.maxAvgPower, a.avgPower ?? 0);
    weeks[d].add(weekOf(dayKey(a.startedAt, tz)));
  }
  for (const e of exercises) {
    stats.WORKOUT.reps += e.sets * e.reps;
    stats.WORKOUT.tonnes += (e.sets * e.reps * (e.loadKg ?? 0)) / 1000;
  }
  for (const d of DISCIPLINES) stats[d].weekStreak = bestConsecutive(weeks[d]);
  return stats;
}

/** Plus longue série de jours consécutifs (clés YYYY-MM-DD). */
export function bestStreakDays(keys: Iterable<string>) {
  const set = new Set(keys); let best = 0;
  for (const k of set) {
    if (set.has(shiftDay(k, -1))) continue;
    let n = 0, c = k;
    while (set.has(c)) { n++; c = shiftDay(c, 1); }
    best = Math.max(best, n);
  }
  return best;
}