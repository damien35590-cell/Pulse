import { dayKey } from "./dates";

/** Jours calendaires restants (J-X), dans le fuseau de l'utilisateur. 0 = aujourd'hui. */
export const daysUntil = (date: Date, now: Date, tz: string) => Math.round((Date.parse(dayKey(date, tz)) - Date.parse(dayKey(now, tz))) / 864e5);

type A = { type: string; startedAt: Date; distanceM: number; elevationGainM: number };
/** Préparation sur les 28 derniers jours : plus longue sortie du sport vs distance visée, D+ cumulé vs D+ visé. */
export function readiness(ev: { sport: string; targetDistance: number | null; targetElevation: number | null }, acts: A[], now: Date) {
  const recent = acts.filter((a) => a.type === ev.sport && +now - +a.startedAt <= 28 * 864e5 && a.startedAt <= now);
  const longestKm = recent.reduce((m, a) => Math.max(m, a.distanceM / 1000), 0), dPlus = recent.reduce((s, a) => s + a.elevationGainM, 0);
  return {
    longestKm, dPlus,
    distancePct: ev.targetDistance ? (longestKm / ev.targetDistance) * 100 : null,
    elevationPct: ev.targetElevation ? (dPlus / ev.targetElevation) * 100 : null,
  };
}
