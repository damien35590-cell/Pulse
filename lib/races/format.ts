import { raceDayKey } from "./time";

const fr = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
const pad = (n: number) => String(n).padStart(2, "0");

/** 14 → "14 km", 7.5 → "7,5 km". */
export const fmtRaceDistance = (km: number) => `${fr(km, 1)} km`;

/** Durée "h:mm:ss" (ou "mm:ss" sous l'heure). */
export const fmtHms = (s: number) => {
  const t = Math.round(s), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
};

/** Allure cible "5'21/km" ; vitesse "28,5 km/h" pour le vélo. */
export function fmtGoalPace(goalTimeS: number, km: number, sport?: string) {
  if (!(goalTimeS > 0 && km > 0)) return null;
  if (sport === "RIDE") return `${fr(km / (goalTimeS / 3600), 1)} km/h`;
  const s = Math.round(goalTimeS / km);
  return `${Math.floor(s / 60)}'${pad(s % 60)}/km`;
}

/** 1800 → "18,00 €". */
export const fmtPrice = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;

/** Classement "123e / 2600" ("1er" pour le premier). */
export const fmtRank = (rank: number, of?: number | null) => `${rank}${rank === 1 ? "er" : "e"}${of ? ` / ${of.toLocaleString("fr-FR")}` : ""}`;

const day = (date: Date | string) => new Date(`${raceDayKey(date)}T12:00:00Z`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Pastille de date : { d: "27", m: "MARS" }. */
export const datePill = (date: Date | string) => ({
  d: String(day(date).getUTCDate()),
  m: day(date).toLocaleDateString("fr-FR", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase(),
});
/** "Mars 2027". */
export const monthLabel = (date: Date | string) => cap(day(date).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }));
/** "samedi 27 mars 2027". */
export const fmtRaceDay = (date: Date | string, year = true) => day(date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });

export const PLATFORM_LABEL: Record<string, string | null> = { NEXTRUN: "NextRun", KLIKEGO: "Klikego", OTHER: null };
export const STATUS_LABEL = { REGISTERED: "Inscrit", COMPLETED: "Terminée", DNS: "Non partant", DNF: "Abandon" } as const;
