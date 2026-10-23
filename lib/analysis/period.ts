/**
 * Période de la page Analyse : un nombre de semaines (1 à 104) qui se termine sur la semaine choisie.
 * URL : ?w=<semaines>&to=<AAAA-MM-JJ> (to absent = jusqu'à aujourd'hui). Les analyses restent groupées par semaine
 * (lundi → dimanche, fuseau de l'utilisateur) : `now` renvoyé ici est la fin de la période, à passer aux get*Analysis.
 * Pure (tests : tools/test-period.ts).
 */
import { dayKey, shiftDay, weekKeys } from "../dates";

export const MAX_WEEKS = 104;
export const PRESETS = [
  { weeks: 4, label: "4 sem." },
  { weeks: 12, label: "12 sem." },
  { weeks: 26, label: "6 mois" },
  { weeks: 52, label: "1 an" },
] as const;

export type Period = {
  weeks: number;
  /** Dernier jour inclus (AAAA-MM-JJ) : aujourd'hui pour la période en cours, sinon le dimanche de la semaine choisie. */
  endKey: string;
  /** Lundi de la première semaine (AAAA-MM-JJ). */
  startKey: string;
  /** Instant de fin, à passer comme `now` aux analyses (toutes les données au-delà sont ignorées). */
  now: Date;
  /** true : la période se termine aujourd'hui (pas de paramètre `to` dans l'URL). */
  current: boolean;
  /** Preset correspondant, ou null pour une période personnalisée. */
  preset: number | null;
};

const isKey = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));

/** Dernier instant (à l'heure près) du jour `key` dans le fuseau `tz`. */
export function endOfDay(key: string, tz: string): Date {
  let t = Date.parse(shiftDay(key, 1) + "T00:00:00Z") + 14 * 3600e3; // midi du lendemain en UTC : forcément le lendemain partout en Europe
  while (dayKey(new Date(t), tz) > key) t -= 3600e3; // t = début de la dernière heure du jour `key`
  return new Date(t + 3599e3);
}

export function parsePeriod(sp: { w?: string; to?: string }, tz: string, now = new Date()): Period {
  const n = Math.round(Number(sp.w));
  const weeks = Number.isFinite(n) && n >= 1 ? Math.min(MAX_WEEKS, n) : 12;
  const today = dayKey(now, tz), thisMon = weekKeys(now, tz)[0];
  // Une date de fin dans la semaine en cours (ou dans le futur) = période en cours
  const toMon = isKey(sp.to) ? weekKeys(new Date(Date.parse(sp.to + "T12:00:00Z")), "UTC")[0] : null;
  const current = !toMon || toMon >= thisMon;
  const endKey = current ? today : shiftDay(toMon!, 6);
  const endMon = current ? thisMon : toMon!;
  return {
    weeks, endKey, startKey: shiftDay(endMon, -7 * (weeks - 1)),
    now: current ? now : endOfDay(endKey, tz), current,
    preset: current && PRESETS.some((p) => p.weeks === weeks) ? weeks : null,
  };
}

/** Paramètres d'URL de la période (to omis pour la période en cours). */
export const periodParams = (p: Pick<Period, "weeks" | "current" | "endKey">): Record<string, string> =>
  p.current ? { w: String(p.weeks) } : { w: String(p.weeks), to: p.endKey };

/** Nombre de semaines entre deux dates (incluses), semaines entières lundi → dimanche. */
export function weeksBetween(fromKey: string, toKey: string): number {
  const mon = (k: string) => weekKeys(new Date(Date.parse(k + "T12:00:00Z")), "UTC")[0];
  const [a, b] = fromKey <= toKey ? [fromKey, toKey] : [toKey, fromKey];
  return Math.min(MAX_WEEKS, Math.round((Date.parse(mon(b)) - Date.parse(mon(a))) / (7 * 864e5)) + 1);
}

const fmt = (k: string, year: boolean) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
/** « 4 août → 23 oct. 2026 » ; l'année apparaît sur les deux dates quand elles diffèrent. */
export function periodLabel(p: Pick<Period, "startKey" | "endKey">): string {
  const split = p.startKey.slice(0, 4) !== p.endKey.slice(0, 4);
  return `${fmt(p.startKey, split)} → ${fmt(p.endKey, true)}`;
}
/** « 12 semaines », « 1 semaine ». */
export const weeksLabel = (w: number) => `${w} semaine${w > 1 ? "s" : ""}`;
