import { dayKey, shiftDay } from "./dates";

export type Metrics = { distance: number; time: number; dPlus: number }; // km, secondes, mètres
export type DayPoint = { date: string } & Metrics;
type Raw = { startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number };

const EMPTY = (): Metrics => ({ distance: 0, time: 0, dPlus: 0 });
const key = (d: Date | string, tz: string) => (typeof d === "string" ? d.slice(0, 10) : dayKey(d, tz));

/**
 * Tableau COMPLET jour par jour entre startDate et endDate (inclus) : les jours sans activité valent { distance: 0, time: 0, dPlus: 0 },
 * pour que l'axe X d'un graphique reste continu et proportionnel. Plusieurs sorties le même jour sont additionnées.
 */
export function fillMissingDates(data: Raw[], startDate: Date | string, endDate: Date | string, tz = "Europe/Paris"): DayPoint[] {
  const start = key(startDate, tz), end = key(endDate, tz), by = new Map<string, Metrics>();
  for (const a of data) {
    const k = dayKey(a.startedAt, tz), m = by.get(k) ?? EMPTY();
    m.distance += a.distanceM / 1000; m.time += a.movingTimeS; m.dPlus += a.elevationGainM;
    by.set(k, m);
  }
  const out: DayPoint[] = [];
  for (let k = start, n = 0; k <= end && n < 4000; k = shiftDay(k, 1), n++) out.push({ date: k, ...(by.get(k) ?? EMPTY()) });
  return out;
}

const monday = (k: string) => shiftDay(k, -((new Date(k + "T00:00:00Z").getUTCDay() + 6) % 7));

/** Regroupe un tableau journalier continu en semaines (lundi→dimanche), sans jamais sauter une semaine vide. */
export function groupByWeek(days: DayPoint[]): ({ weekStart: string } & Metrics)[] {
  const out: ({ weekStart: string } & Metrics)[] = [];
  for (const d of days) {
    const w = monday(d.date), last = out[out.length - 1];
    if (last && last.weekStart === w) { last.distance += d.distance; last.time += d.time; last.dPlus += d.dPlus; }
    else out.push({ weekStart: w, distance: d.distance, time: d.time, dPlus: d.dPlus });
  }
  return out;
}
