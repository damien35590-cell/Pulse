import { dayKey } from "../dates";
import { getRaceStartDate, raceDayKey, RACE_TZ, type RaceWhen } from "./time";

/**
 * Rattachement d'une activité à une course (jour J). Fonction pure : testée dans tools/test-race-match.ts.
 */

export type MatchRace = RaceWhen & { sport: string; targetDistance: number | null };
export type MatchActivity = { type: string; startedAt: Date; distanceM: number };

const BEFORE_MS = 45 * 60e3, AFTER_MS = 3 * 3600e3;
const MIN_RATIO = 0.75, MAX_RATIO = 1.3;

/** Sports d'activité compatibles avec le sport de la course (la rando accepte aussi la marche). */
export const raceActivityTypes = (sport: string) => (sport === "HIKE" || sport === "WALK" ? ["HIKE", "WALK"] : [sport]);

/** La meilleure activité du jour J pour cette course, ou null. */
export function findRaceActivity<A extends MatchActivity>(race: MatchRace, activities: A[]): A | null {
  const day = raceDayKey(race.date), types = raceActivityTypes(race.sport);
  const hasStart = !!race.startTime, start = +getRaceStartDate(race);
  const km = race.targetDistance && race.targetDistance > 0 ? race.targetDistance : null;

  const ok = activities.filter((a) => {
    if (!types.includes(a.type) || dayKey(a.startedAt, RACE_TZ) !== day) return false;
    if (hasStart && (+a.startedAt < start - BEFORE_MS || +a.startedAt > start + AFTER_MS)) return false;
    if (km) { const r = a.distanceM / 1000 / km; if (r < MIN_RATIO || r > MAX_RATIO) return false; }
    return true;
  });
  if (!ok.length) return null;

  // Distance la plus proche (à 1 % près), puis départ le plus proche de l'heure de la course ; sans objectif de distance, la plus longue.
  const dist = (a: A) => (km ? Math.round((Math.abs(a.distanceM / 1000 - km) / km) * 100) : -a.distanceM);
  const gap = (a: A) => (hasStart ? Math.abs(+a.startedAt - start) : 0);
  return [...ok].sort((a, b) => dist(a) - dist(b) || gap(a) - gap(b))[0];
}
