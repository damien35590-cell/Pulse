/** Heures de départ des courses : `startTime` ("HH:mm") est l'heure locale Europe/Paris, `date` le jour à midi UTC. */
export const RACE_TZ = "Europe/Paris";

export type RaceWhen = { date: Date | string; startTime?: string | null };

const pad = (n: number) => String(n).padStart(2, "0");
/** "AAAA-MM-JJ" du jour de la course (Date à midi UTC ou chaîne ISO). */
export const raceDayKey = (date: Date | string) => (typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10));
const dayKeyIn = (d: Date, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

/** Décalage (ms) du fuseau par rapport à UTC à l'instant donné (+1 h l'hiver, +2 h l'été pour Paris). */
function tzOffset(at: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(at)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(at / 1000) * 1000;
}

/** Heure locale (fuseau `tz`) → instant UTC, correct de part et d'autre du changement d'heure. */
function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const first = guess - tzOffset(guess, tz);
  return new Date(guess - tzOffset(first, tz));
}

/** Départ de la course en instant UTC ; sans heure : début de journée à Paris. */
export function getRaceStartDate(race: RaceWhen): Date {
  const [y, m, d] = raceDayKey(race.date).split("-").map(Number);
  const t = race.startTime && /^\d{2}:\d{2}$/.test(race.startTime) ? race.startTime.split(":").map(Number) : [0, 0];
  return zonedToUtc(y, m, d, t[0], t[1], RACE_TZ);
}

/** Fin du jour de la course à Paris : la course reste « à venir » toute la journée. */
const raceDayEnd = (race: RaceWhen) => {
  const [y, m, d] = raceDayKey(race.date).split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return zonedToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, RACE_TZ);
};

export type Countdown = { days: number; hours: number; minutes: number; seconds: number; isToday: boolean; isPast: boolean; label: string; short: string };

/**
 * Compte à rebours. `days` = jours calendaires (Paris) jusqu'au jour J ; `hours`/`minutes`/`seconds` = reste avant le départ.
 * `label` : "J-161", "Demain 15:00", "Aujourd'hui · départ dans 2 h 10", "Terminée". `short` : version courte pour les listes.
 */
export function getCountdown(race: RaceWhen, now: Date = new Date()): Countdown {
  const start = getRaceStartDate(race);
  const days = Math.round((Date.parse(raceDayKey(race.date)) - Date.parse(dayKeyIn(now, RACE_TZ))) / 864e5);
  const isPast = +now >= +raceDayEnd(race), isToday = days === 0 && !isPast;
  const left = Math.max(0, +start - +now), total = Math.floor(left / 1000);
  const base = { days, hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60, isToday, isPast };
  if (isPast) return { ...base, label: "Terminée", short: "Terminée" };
  if (isToday) {
    if (!race.startTime) return { ...base, label: "Aujourd’hui", short: "Aujourd’hui" };
    if (left <= 0) return { ...base, label: "Aujourd’hui · c’est parti !", short: "En cours" };
    const h = Math.floor(total / 3600), mi = Math.floor(total / 60) % 60;
    return { ...base, label: `Aujourd’hui · départ dans ${h ? `${h} h ${pad(mi)}` : `${Math.max(1, mi)} min`}`, short: "Aujourd’hui" };
  }
  if (days === 1) return { ...base, label: race.startTime ? `Demain ${race.startTime}` : "Demain", short: "Demain" };
  return { ...base, label: `J-${days}`, short: `J-${days}` };
}

/** Course passée sans résultat saisi (statut encore « Inscrit »). */
export const needsResult = (race: RaceWhen & { status: string }, now: Date = new Date()) => race.status === "REGISTERED" && getCountdown(race, now).isPast;
