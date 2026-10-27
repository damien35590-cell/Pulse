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
export type MatchSession = { id: string; kind: SessionKind; isKeySession: boolean; rejectedActivityIds?: string[] | null };

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
  return isDemanding(s) ? intensity === "hard" : true;
}

/** Première séance de la file (déjà triée : semaine puis ordre) qui convient, parmi les LOOKAHEAD premières ; null sinon. */
export function pickSession<T extends MatchSession>(queue: T[], a: MatchActivity): T | null {
  const intensity = activityIntensity(a);
  return queue.slice(0, LOOKAHEAD).find((s) => fits(s, a, intensity)) ?? null;
}
