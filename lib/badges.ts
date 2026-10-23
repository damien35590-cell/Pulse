import { dayKey, shiftDay } from "./dates";

export type Discipline = "GLOBAL" | "RIDE" | "RUN" | "HIKE" | "WORKOUT";
export type BadgeIcon =
  | "foot" | "flag" | "mountain" | "flame" | "clock" | "route" | "bike" | "dumbbell" | "zap" | "calendar" | "repeat"
  | "sunrise" | "moon" | "sun" | "snow" | "rain" | "thermo" | "smile" | "heart" | "book" | "sparkles" | "weight"
  | "layers" | "compass" | "timer" | "trend" | "trophy";

const SPORT_DISCIPLINES: Discipline[] = ["RIDE", "RUN", "HIKE", "WORKOUT"];
export const DISCIPLINES: Discipline[] = ["GLOBAL", ...SPORT_DISCIPLINES];

export type DisciplineStats = {
  count: number; km: number; elevation: number; hours: number;
  maxKm: number; maxHours: number; maxElevation: number;
  maxAvgPower: number; maxPeakPower: number; withPower: number;
  activeDays: number; monthsOfYear: number; weekStreak: number; bestWeekKm: number;
  early: number; late: number; rain: number; cold: number; hot: number; great: number; hard: number; noted: number;
  sports: number; speed5k: number;
  reps: number; tonnes: number; maxLoadKg: number; maxSessionTonnes: number; exercises: number;
  pullReps: number; pushReps: number; dipReps: number;
};
export type StatKey = keyof DisciplineStats;
export type BadgeStats = Record<Discipline, DisciplineStats>;

export type BadgeDef = {
  id: string; discipline: Discipline; name: string; desc: string; icon: BadgeIcon;
  stat: StatKey; unit: string; decimals: number; tiers: [number, number, number, number]; // Bronze, Argent, Or, Diamant
};

// Ordre des arguments : discipline, id, nom, description, icône, statistique, unité, [bronze, argent, or, diamant], décimales affichées
const B = (
  discipline: Discipline, id: string, name: string, desc: string, icon: BadgeIcon, stat: StatKey, unit: string,
  tiers: [number, number, number, number], decimals = 0,
): BadgeDef => ({ id, discipline, name, desc, icon, stat, unit, decimals, tiers });

/** Badges calculés à la volée : rien à synchroniser, rien à semer en base. Tous les seuils se règlent ici. */
export const BADGES: BadgeDef[] = [
  // ───── Général (tous sports confondus, marche comprise) ─────
  B("GLOBAL", "g-count", "Sortie après sortie", "Sorties enregistrées, tous sports confondus.", "foot", "count", "sorties", [1, 50, 200, 500]),
  B("GLOBAL", "g-km", "Autour du monde", "Kilomètres cumulés, tous sports confondus.", "route", "km", "km", [100, 1000, 5000, 10000]),
  B("GLOBAL", "g-elev", "Everest en pièces", "Dénivelé cumulé, tous sports (8 849 m = un Everest).", "mountain", "elevation", "m", [1000, 8849, 17698, 26547]),
  B("GLOBAL", "g-hours", "Le temps long", "Heures passées en mouvement.", "clock", "hours", "h", [10, 100, 300, 1000]),
  B("GLOBAL", "g-days", "Jours de sport", "Jours différents avec au moins une sortie.", "calendar", "activeDays", "jours", [10, 50, 150, 365]),
  B("GLOBAL", "g-weeks", "Rythme de croisière", "Semaines d’affilée avec au moins une sortie, sans pression au jour le jour.", "calendar", "weekStreak", "semaines", [4, 12, 26, 52]),
  B("GLOBAL", "g-months", "Toute l’année", "Mois de l’année où vous avez bougé au moins une fois.", "sun", "monthsOfYear", "mois", [3, 6, 9, 12]),
  B("GLOBAL", "g-multi", "Touche-à-tout", "Disciplines pratiquées : vélo, running, rando, musculation.", "sparkles", "sports", "disciplines", [1, 2, 3, 4]),
  B("GLOBAL", "g-early", "Lève-tôt", "Sorties commencées avant 7 h.", "sunrise", "early", "sorties", [1, 10, 30, 100]),
  B("GLOBAL", "g-late", "Noctambule", "Sorties commencées après 20 h.", "moon", "late", "sorties", [1, 5, 15, 40]),
  B("GLOBAL", "g-rain", "Sous la pluie", "Sorties sous la pluie (quand la météo est enregistrée).", "rain", "rain", "sorties", [1, 10, 30, 80]),
  B("GLOBAL", "g-cold", "Frisquet", "Sorties par 3 °C ou moins.", "snow", "cold", "sorties", [1, 10, 30, 80]),
  B("GLOBAL", "g-hot", "Plein soleil", "Sorties par 30 °C ou plus.", "thermo", "hot", "sorties", [1, 5, 15, 30]),
  B("GLOBAL", "g-great", "Jambes de feu", "Sorties ressenties comme excellentes.", "smile", "great", "sorties", [1, 10, 40, 120]),
  B("GLOBAL", "g-hard", "Je m’accroche", "Sorties ressenties comme difficiles… et terminées quand même.", "heart", "hard", "sorties", [1, 5, 20, 50]),
  B("GLOBAL", "g-noted", "Carnet de bord", "Sorties avec un commentaire.", "book", "noted", "commentaires", [3, 20, 75, 200]),
  // ───── Vélo ─────
  B("RIDE", "r-count", "Pédaleur", "Sorties à vélo enregistrées.", "bike", "count", "sorties", [1, 25, 100, 300]),
  B("RIDE", "r-km", "Tour de Bretagne", "Kilomètres cumulés à vélo.", "route", "km", "km", [500, 1500, 3000, 6000]),
  B("RIDE", "r-elev", "Grimpeur", "Dénivelé cumulé à vélo (8 849 m = un Everest).", "mountain", "elevation", "m", [1000, 5000, 8849, 17698]),
  B("RIDE", "r-hours", "Heures en selle", "Temps passé à pédaler.", "clock", "hours", "h", [10, 50, 150, 400]),
  B("RIDE", "r-long", "Sortie fleuve", "Votre plus longue sortie à vélo.", "flag", "maxKm", "km", [50, 100, 150, 200]),
  B("RIDE", "r-climb", "Journée de col", "Plus gros dénivelé sur une seule sortie.", "mountain", "maxElevation", "m", [300, 800, 1500, 3000]),
  B("RIDE", "r-week", "Semaine monstre", "Kilomètres sur votre meilleure semaine.", "trend", "bestWeekKm", "km", [50, 100, 200, 350]),
  B("RIDE", "r-weeks", "Régulier", "Semaines d’affilée avec au moins une sortie.", "calendar", "weekStreak", "semaines", [4, 12, 26, 52]),
  B("RIDE", "r-power", "Watt mérité", "Meilleure puissance moyenne sur une séance.", "zap", "maxAvgPower", "W", [150, 200, 250, 300]),
  B("RIDE", "r-peak", "Sprinteur", "Pic de puissance sur une séance.", "zap", "maxPeakPower", "W", [500, 800, 1000, 1400]),
  B("RIDE", "r-sensor", "Au capteur", "Sorties avec puissance enregistrée (home trainer, capteur).", "zap", "withPower", "sorties", [1, 10, 40, 120]),
  // ───── Course à pied ─────
  B("RUN", "u-count", "Première foulée", "Sorties de course enregistrées.", "foot", "count", "sorties", [1, 25, 100, 300]),
  B("RUN", "u-long", "Cinq, dix, semi, marathon", "Votre plus longue course d’une traite.", "flag", "maxKm", "km", [5, 10, 21.0975, 42.195], 1),
  B("RUN", "u-km", "Kilomètres au compteur", "Kilomètres cumulés en course à pied.", "route", "km", "km", [100, 500, 1000, 2500]),
  B("RUN", "u-time", "Longue durée", "Votre plus longue course en temps.", "timer", "maxHours", "h", [0.5, 1, 2, 3.5], 1),
  B("RUN", "u-week", "Semaine de course", "Kilomètres sur votre meilleure semaine.", "trend", "bestWeekKm", "km", [10, 25, 50, 80]),
  B("RUN", "u-elev", "Trailer", "Dénivelé cumulé en course à pied.", "mountain", "elevation", "m", [250, 1000, 3000, 8849]),
  B("RUN", "u-weeks", "Régulier", "Semaines d’affilée avec au moins une sortie.", "calendar", "weekStreak", "semaines", [4, 12, 26, 52]),
  B("RUN", "u-speed", "Allure 5 km", "Vitesse moyenne sur votre meilleur 5 km (10 km/h = 30 min).", "zap", "speed5k", "km/h", [8, 10, 12, 15], 1),
  // ───── Randonnée ─────
  B("HIKE", "h-count", "Marcheur des cimes", "Randonnées enregistrées.", "mountain", "count", "randos", [1, 10, 30, 100]),
  B("HIKE", "h-km", "Sur les sentiers", "Kilomètres cumulés en randonnée.", "route", "km", "km", [50, 200, 500, 1000]),
  B("HIKE", "h-elev", "Montagnard", "Dénivelé cumulé en randonnée.", "mountain", "elevation", "m", [1000, 5000, 10000, 25000]),
  B("HIKE", "h-time", "Journée entière", "Votre plus longue randonnée en temps de marche.", "clock", "maxHours", "h", [4, 6, 8, 10], 1),
  B("HIKE", "h-long", "Grande traversée", "Votre plus longue randonnée en distance.", "compass", "maxKm", "km", [10, 20, 30, 45]),
  B("HIKE", "h-climb", "Belle montée", "Plus gros dénivélé sur une seule randonnée.", "trend", "maxElevation", "m", [300, 800, 1500, 2500]),
  B("HIKE", "h-hours", "Heures de sentier", "Temps cumulé en randonnée.", "timer", "hours", "h", [10, 40, 100, 250]),
  // ───── Musculation ─────
  B("WORKOUT", "w-count", "Séance après séance", "Séances de musculation enregistrées.", "dumbbell", "count", "séances", [1, 25, 100, 300]),
  B("WORKOUT", "w-weeks", "Régulier", "Semaines d’affilée avec au moins une séance.", "calendar", "weekStreak", "semaines", [4, 12, 26, 52]),
  B("WORKOUT", "w-reps", "Mille et une reps", "Répétitions cumulées, poids de corps compris.", "repeat", "reps", "reps", [500, 2500, 10000, 50000]),
  B("WORKOUT", "w-tonnes", "Poids lourd", "Tonnes soulevées au total (exercices avec charge).", "flame", "tonnes", "t", [1, 10, 50, 200], 1),
  B("WORKOUT", "w-load", "Charge max", "Votre charge la plus lourde sur un exercice.", "weight", "maxLoadKg", "kg", [20, 50, 100, 150]),
  B("WORKOUT", "w-session", "Grosse séance", "Tonnes soulevées sur une seule séance.", "trophy", "maxSessionTonnes", "t", [1, 3, 6, 10], 1),
  B("WORKOUT", "w-variety", "Boîte à outils", "Exercices différents pratiqués.", "layers", "exercises", "exercices", [5, 15, 30, 60]),
  B("WORKOUT", "w-pull", "Roi de la traction", "Tractions cumulées (exercices dont le nom contient « traction »).", "trend", "pullReps", "reps", [50, 250, 1000, 3000]),
  B("WORKOUT", "w-push", "Pompes à gogo", "Pompes cumulées (exercices dont le nom contient « pompe »).", "dumbbell", "pushReps", "reps", [100, 500, 2000, 10000]),
  B("WORKOUT", "w-dips", "Barres parallèles", "Dips cumulés (exercices dont le nom contient « dips »).", "repeat", "dipReps", "reps", [50, 250, 1000, 3000]),
  B("WORKOUT", "w-long", "Séance marathon", "Votre plus longue séance en temps.", "timer", "maxHours", "h", [1, 1.5, 2, 3], 1),
];

/** Version sérialisable (aucune fonction), prête à passer à un composant client. */
export type EvaluatedBadge = {
  id: string; discipline: Discipline; name: string; desc: string; icon: BadgeIcon; unit: string; decimals: number;
  tiers: number[]; value: number; tier: number; next: number | null;
};

export function evaluateBadges(stats: BadgeStats): EvaluatedBadge[] {
  return BADGES.map((b) => {
    const value = stats[b.discipline][b.stat];
    const tier = b.tiers.filter((t) => value >= t).length;
    return {
      id: b.id, discipline: b.discipline, name: b.name, desc: b.desc, icon: b.icon, unit: b.unit, decimals: b.decimals,
      tiers: [...b.tiers], value, tier, next: b.tiers[tier] ?? null,
    };
  });
}

type ActRow = {
  type: string; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number;
  avgPower: number | null; maxPower: number | null; weather: unknown; feeling: string | null;
};
type ExRow = { activityId: string; name: string; sets: number; reps: number; loadKg: number | null };
type Extras = { noted: number; best5kSec?: number | null };

const empty = (): DisciplineStats => ({
  count: 0, km: 0, elevation: 0, hours: 0, maxKm: 0, maxHours: 0, maxElevation: 0, maxAvgPower: 0, maxPeakPower: 0, withPower: 0,
  activeDays: 0, monthsOfYear: 0, weekStreak: 0, bestWeekKm: 0, early: 0, late: 0, rain: 0, cold: 0, hot: 0, great: 0, hard: 0, noted: 0,
  sports: 0, speed5k: 0, reps: 0, tonnes: 0, maxLoadKg: 0, maxSessionTonnes: 0, exercises: 0, pullReps: 0, pushReps: 0, dipReps: 0,
});

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

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function buildBadgeStats(acts: ActRow[], exercises: ExRow[], tz: string, extras: Extras): BadgeStats {
  const stats = Object.fromEntries(DISCIPLINES.map((d) => [d, empty()])) as BadgeStats;
  const days = Object.fromEntries(DISCIPLINES.map((d) => [d, new Set<string>()])) as Record<Discipline, Set<string>>;
  const months = Object.fromEntries(DISCIPLINES.map((d) => [d, new Set<number>()])) as Record<Discipline, Set<number>>;
  const weekKm = Object.fromEntries(DISCIPLINES.map((d) => [d, new Map<number, number>()])) as Record<Discipline, Map<number, number>>;
  const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz });

  for (const a of acts) {
    const targets: Discipline[] = SPORT_DISCIPLINES.includes(a.type as Discipline) ? ["GLOBAL", a.type as Discipline] : ["GLOBAL"];
    const key = dayKey(a.startedAt, tz);
    const week = weekOf(key);
    const month = Number(key.slice(5, 7));
    const hour = Number(hourFmt.format(a.startedAt));
    const km = a.distanceM / 1000, h = a.movingTimeS / 3600;
    const w = (a.weather ?? null) as { tempC?: unknown; precipMm?: unknown } | null;
    const temp = typeof w?.tempC === "number" ? w.tempC : null;
    const precip = typeof w?.precipMm === "number" ? w.precipMm : null;

    for (const d of targets) {
      const s = stats[d];
      s.count++; s.km += km; s.elevation += a.elevationGainM; s.hours += h;
      s.maxKm = Math.max(s.maxKm, km);
      s.maxHours = Math.max(s.maxHours, h);
      s.maxElevation = Math.max(s.maxElevation, a.elevationGainM);
      s.maxAvgPower = Math.max(s.maxAvgPower, a.avgPower ?? 0);
      s.maxPeakPower = Math.max(s.maxPeakPower, a.maxPower ?? 0);
      if ((a.avgPower ?? 0) > 0) s.withPower++;
      if (hour < 7) s.early++;
      if (hour >= 20) s.late++;
      if (precip !== null && precip >= 1) s.rain++;
      if (temp !== null && temp <= 3) s.cold++;
      if (temp !== null && temp >= 30) s.hot++;
      if (a.feeling === "GREAT") s.great++;
      if (a.feeling === "HARD") s.hard++;
      days[d].add(key);
      months[d].add(month);
      weekKm[d].set(week, (weekKm[d].get(week) ?? 0) + km);
    }
  }

  // Musculation : reps, tonnage, charges, exercices reconnus par leur nom
  const wo = stats.WORKOUT;
  const names = new Set<string>();
  const sessionT = new Map<string, number>();
  for (const e of exercises) {
    const n = norm(e.name);
    const reps = e.sets * e.reps;
    const t = (reps * (e.loadKg ?? 0)) / 1000;
    names.add(n);
    wo.reps += reps; wo.tonnes += t;
    wo.maxLoadKg = Math.max(wo.maxLoadKg, e.loadKg ?? 0);
    sessionT.set(e.activityId, (sessionT.get(e.activityId) ?? 0) + t);
    if (/traction|pull[- ]?up|chin[- ]?up/.test(n)) wo.pullReps += reps;
    if (/pompe|push[- ]?up/.test(n)) wo.pushReps += reps;
    if (/\bdips?\b/.test(n)) wo.dipReps += reps;
  }
  wo.exercises = names.size;
  wo.maxSessionTonnes = Math.max(0, ...Array.from(sessionT.values()));

  for (const d of DISCIPLINES) {
    const s = stats[d];
    s.activeDays = days[d].size;
    s.monthsOfYear = months[d].size;
    s.weekStreak = bestConsecutive(new Set(Array.from(weekKm[d].keys())));
    s.bestWeekKm = Math.max(0, ...Array.from(weekKm[d].values()));
  }
  stats.GLOBAL.sports = SPORT_DISCIPLINES.filter((d) => stats[d].count > 0).length;
  stats.GLOBAL.noted = extras.noted;
  if (extras.best5kSec) stats.RUN.speed5k = 18000 / extras.best5kSec; // 5 km → km/h

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

// ───────── Validation manuelle des paliers obtenus ─────────

export const TIER_NAMES = ["Bronze", "Argent", "Or", "Diamant"] as const;

/** Un palier obtenu (ligne UserBadge, identifiant « <badge>:<palier> »), sérialisable pour les composants client. */
export type BadgeItem = {
  key: string; badgeId: string; discipline: Discipline; tier: number; tierName: string;
  name: string; desc: string; criterion: string; icon: BadgeIcon;
  earnedAt: string; // ISO
  acknowledged: boolean;
};

const BY_ID = new Map(BADGES.map((b) => [b.id, b]));

/** Identifiant « g-km:2 » → palier. null si le badge ou le palier n'existe plus dans BADGES. */
export function badgeItemFrom(row: { badgeId: string; earnedAt: Date; acknowledgedAt: Date | null }): BadgeItem | null {
  const [id, t] = row.badgeId.split(":");
  const def = BY_ID.get(id), tier = Number(t);
  if (!def || !Number.isInteger(tier) || tier < 1 || tier > def.tiers.length) return null;
  const target = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: def.decimals }).format(def.tiers[tier - 1]);
  return {
    key: row.badgeId, badgeId: id, discipline: def.discipline, tier, tierName: TIER_NAMES[tier - 1],
    name: def.name, desc: def.desc, criterion: `${target} ${def.unit}`, icon: def.icon,
    earnedAt: row.earnedAt.toISOString(), acknowledged: row.acknowledgedAt !== null,
  };
}

/** Du plus ancien au plus récent ; à date égale (import en lot) : ordre du catalogue puis palier croissant. */
export function sortBadgeItems(items: BadgeItem[]): BadgeItem[] {
  const order = new Map(BADGES.map((b, i) => [b.id, i]));
  return [...items].sort((a, b) =>
    a.earnedAt.localeCompare(b.earnedAt) || (order.get(a.badgeId) ?? 0) - (order.get(b.badgeId) ?? 0) || a.tier - b.tier);
}
