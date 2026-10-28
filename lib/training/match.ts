/**
 * Appariement d'une sortie à une séance du programme Running (fonctions pures ; tests : tools/test-session-match.ts).
 * Une séance clé (test VMA, fractionné, seuil…) n'accepte qu'une sortie dont l'intensité colle ; un footing facile ne peut
 * valider qu'une séance d'endurance. Une paire détachée à la main (PlannedSession.rejectedActivityIds) n'est jamais reliée de nouveau.
 */
import type { SessionKind } from "@prisma/client";
import { paceUpper, parseRibbon } from "../art/zone-ribbon";

export type Intensity = "hard" | "easy" | "unknown";
export type MatchActivity = {
  id: string; isInterval?: boolean | null; sessionType?: string | null; zoneRibbon?: unknown;
  distanceM?: number | null; movingTimeS?: number | null; vmaKmh?: number | null;
};
export type MatchSession = { id: string; kind: SessionKind; isKeySession: boolean; rejectedActivityIds?: string[] | null; plannedDurationS?: number | null };

/** Une sortie ne valide la sortie longue que si elle en fait au moins 90 % de la durée prévue. */
export const LONG_SHARE = 0.9;
/** Assez longue pour la séance ? Seule la sortie longue a un plancher (90 % de sa durée prévue, quand elle est connue). */
export const longEnough = (s: Pick<MatchSession, "kind" | "plannedDurationS">, a: MatchActivity) =>
  s.kind !== "LONG_RUN" || !s.plannedDurationS || (a.movingTimeS ?? 0) >= LONG_SHARE * s.plannedDurationS;

/** Part du temps passée en Z4 ou plus à partir de laquelle une sortie compte comme intense. */
export const HARD_ZONE_SHARE = 0.1;
/** Séances prises en compte dans la file : la prochaine, et quelques suivantes si elle ne convient pas. */
export const LOOKAHEAD = 4;

const ENDURANCE: ReadonlySet<SessionKind> = new Set(["EASY", "RECOVERY", "LONG_RUN"]);
const INTENSE: ReadonlySet<SessionKind> = new Set(["THRESHOLD", "INTERVALS_SHORT", "INTERVALS_LONG", "RACE_PACE", "FARTLEK", "HILLS", "VMA_TEST", "RACE"]);

/** Séance qui demande un effort soutenu : son genre, ou « séance clé » hors endurance (une sortie longue clé reste de l'endurance). */
export const isDemanding = (s: Pick<MatchSession, "kind" | "isKeySession">) => INTENSE.has(s.kind) || (s.isKeySession && !ENDURANCE.has(s.kind));

/**
 * Intensité d'une sortie : son type choisi à la main, sinon fractionné détecté, puis temps en Z4+ du ruban (FC, puissance ou allure),
 * puis allure moyenne plus rapide que l'endurance fondamentale (au-dessus de la borne haute de Z2) ; « unknown » sans aucune donnée.
 */
export function activityIntensity(a: MatchActivity): Intensity {
  if (a.sessionType === "interval" || a.sessionType === "race") return "hard";
  if (a.sessionType === "easy" || a.sessionType === "recovery" || a.sessionType === "endurance") return "easy";
  if (a.isInterval) return "hard";
  const ribbon = parseRibbon(a.zoneRibbon);
  if (ribbon) {
    const total = ribbon.reduce((s, x) => s + x.f, 0), hard = ribbon.filter((x) => x.z >= 4).reduce((s, x) => s + x.f, 0);
    return total > 0 && hard / total >= HARD_ZONE_SHARE ? "hard" : "easy";
  }
  if (a.vmaKmh && a.distanceM && a.movingTimeS && a.distanceM > 0 && a.movingTimeS > 0) {
    const kmh = (a.distanceM / a.movingTimeS) * 3.6;
    return kmh > paceUpper(a.vmaKmh)[1] ? "hard" : "easy";
  }
  return "unknown";
}

/** La sortie peut-elle valider cette séance ? (Une paire détachée est refusée avant tout.) */
export function fits(s: MatchSession, a: MatchActivity, intensity = activityIntensity(a)): boolean {
  if (s.rejectedActivityIds?.includes(a.id)) return false;
  if (!longEnough(s, a)) return false;
  return isDemanding(s) ? intensity === "hard" : true;
}

/** Première séance de la file (déjà triée : semaine puis ordre) qui convient, parmi les LOOKAHEAD premières ; null sinon. */
export function pickSession<T extends MatchSession>(queue: T[], a: MatchActivity): T | null {
  const intensity = activityIntensity(a);
  return queue.slice(0, LOOKAHEAD).find((s) => fits(s, a, intensity)) ?? null;
}

/** Séance candidate d'une semaine : jour prévu (AAAA-MM-JJ), rang, durée prévue. */
export type WeekCandidate = MatchSession & { date: string; orderInWeek: number; plannedDurationS?: number | null };
export type RunShape = "key" | "long" | "easy";
/** Au-delà, sans repère dans la semaine, une sortie facile compte comme sortie longue. */
export const LONG_RUN_S = 75 * 60;

/** Forme d'une séance : clé (intense), sortie longue, ou footing. */
export const sessionShape = (s: Pick<MatchSession, "kind" | "isKeySession">): RunShape => (isDemanding(s) ? "key" : s.kind === "LONG_RUN" ? "long" : "easy");

/**
 * Forme d'une sortie face à sa semaine : intense → clé ; sinon sortie longue ou footing d'après sa durée, comparée aux durées prévues
 * (à mi-chemin entre footing et sortie longue de la semaine), à défaut 75 min. Un type « long » choisi à la main l'emporte.
 */
export function runShape(a: MatchActivity, intensity: Intensity, week: WeekCandidate[]): RunShape {
  if (intensity === "hard") return "key";
  if (a.sessionType === "long") return "long";
  const t = a.movingTimeS ?? 0;
  const longS = week.find((s) => s.kind === "LONG_RUN" && s.plannedDurationS)?.plannedDurationS;
  if (longS) return t >= longS * LONG_SHARE ? "long" : "easy";
  return t >= LONG_RUN_S ? "long" : "easy";
}

/**
 * Séance de la semaine pour une sortie du jour `day` : celle prévue ce jour-là si elle convient ; sinon la plus proche en date parmi celles
 * qui conviennent, celles de la même forme d'abord (sortie longue ↔ sortie longue, footing ↔ footing ; une séance clé seulement pour une sortie
 * intense, cf. fits). Null si aucune ne convient (on retombe alors sur la file, pickSession).
 */
export function pickInWeek<T extends WeekCandidate>(week: T[], a: MatchActivity, day: string): T | null {
  const intensity = activityIntensity(a), fitting = week.filter((s) => fits(s, a, intensity));
  // Un footing de semaine ne consomme pas la sortie longue : elle n'est prise qu'un samedi / dimanche, ou quand plus aucun footing n'attend.
  const weekend = [0, 6].includes(new Date(`${day}T12:00:00Z`).getUTCDay());
  const footingLeft = fitting.some((s) => sessionShape(s) === "easy");
  const ok = fitting.filter((s) => s.kind !== "LONG_RUN" || weekend || !footingLeft);
  if (!ok.length) return null;
  const shape = runShape(a, intensity, week), off = (s: T) => Number(sessionShape(s) !== shape);
  const gap = (s: T) => Math.abs(Date.parse(`${s.date}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 864e5;
  const sameDay = ok.filter((s) => s.date === day);
  const pool = sameDay.length ? sameDay : ok;
  return [...pool].sort((x, y) => off(x) - off(y) || gap(x) - gap(y) || x.orderInWeek - y.orderInWeek)[0];
}
