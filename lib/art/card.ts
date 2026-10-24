/**
 * Quel art pour une carte du fil d'activités (règle 8 du design system : l'art ne vient que de données réelles).
 * - Muscu : SetBars (une barre par série) à la place de la tête de carte.
 * - Course, vélo, rando : la carte reste, le ruban de zones se pose dessous ; une séance clé du programme (VMA, seuil) ou une structure
 *   en intervalles nette passe en EffortStrip à la place de la carte ; un tour MyWhoosh (pas de GPS) n'a que le ruban.
 * - Le reste : inchangé.
 * Fonction pure (tests : tools/test-zone-ribbon.ts).
 */
import { EFFORT_KINDS, hasIntervalStructure, hasPaceIntervalStructure, shortTitle } from "./effort";
import { setGroups, type SetExercise, type SetGroup } from "./set-bars";
import { isSessionType } from "./session-type";
import { parseRibbon, type RibbonSegment } from "./zone-ribbon";

export type CardArt = {
  /** Sous la carte (ou seul pour un tour MyWhoosh). */
  ribbon?: RibbonSegment[];
  /** À la place de la carte. */
  effort?: { segments: RibbonSegment[]; label?: string };
  /** À la place de la tête de carte (muscu). */
  sets?: SetGroup[];
};

export type ArtActivity = {
  type: string;
  source?: string | null;
  /** Une trace GPS exploitable existe (la vignette de carte s'affichera). */
  hasRoute: boolean;
  zoneRibbon?: unknown;
  /** "hr" | "power" | "pace" : l'allure, plus bruitée, a une détection d'intervalles plus stricte. */
  zoneRibbonSource?: string | null;
  /** Détection à 10 s (lib/art/interval.ts) ; null = non évalué, on retombe sur la règle du ruban. */
  isInterval?: boolean | null;
  /** Choix manuel (lib/art/session-type.ts) : prime sur la détection et sur la séance clé du programme. */
  sessionType?: string | null;
  plannedSession?: { kind: string; title: string } | null;
  exercises?: SetExercise[];
};

export function cardArt(a: ArtActivity): CardArt {
  if (a.type === "WORKOUT") {
    const groups = setGroups(a.exercises ?? []);
    return groups.length ? { sets: groups } : {};
  }
  if (a.type !== "RUN" && a.type !== "RIDE" && a.type !== "HIKE") return {};

  const ribbon = parseRibbon(a.zoneRibbon);
  if (!ribbon) return {};
  // Choix manuel : « fractionné » force l'EffortStrip, « footing » et « compétition » ne la montrent jamais (carte + ruban).
  const manual = isSessionType(a.sessionType) ? a.sessionType : null;
  if (manual === "interval") return { effort: { segments: ribbon, label: a.plannedSession && EFFORT_KINDS.includes(a.plannedSession.kind) ? shortTitle(a.plannedSession.title) : undefined } };
  if (manual && (a.hasRoute || (a.type === "RIDE" && a.source === "mywhoosh"))) return { ribbon };
  if (manual) return {};
  const key = a.plannedSession && EFFORT_KINDS.includes(a.plannedSession.kind) ? a.plannedSession : null;
  if (key) return { effort: { segments: ribbon, label: shortTitle(key.title) } };
  if (a.isInterval ?? (a.zoneRibbonSource === "pace" ? hasPaceIntervalStructure : hasIntervalStructure)(ribbon)) return { effort: { segments: ribbon } };
  if (a.hasRoute || (a.type === "RIDE" && a.source === "mywhoosh")) return { ribbon };
  return {};
}
