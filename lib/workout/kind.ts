/** Haut / bas du corps d'une séance de muscu, d'après ses exercices, et alternance. Fonctions pures (tests : tools/test-workout.ts). */
import { musclesOf, UPPER_GROUPS } from "../muscles";
import { isLafayCode } from "./catalog";
import type { Kind, Suggestion } from "./types";

export const KIND_TITLE: Record<Kind, string> = { HAUT: "Haut du corps", BAS: "Bas + abdos", LIBRE: "Séance libre" };

/** Un exercice compte pour le haut ou le bas selon son muscle principal ; l'un doit dominer l'autre d'au moins 50 %, sinon LIBRE. */
export function kindOfNames(names: string[]): Kind {
  let up = 0, low = 0;
  for (const n of names) {
    const top = [...musclesOf(n)].sort((a, b) => b[1] - a[1])[0];
    if (top) (UPPER_GROUPS.has(top[0]) ? up++ : low++);
  }
  if (!up && !low) return "LIBRE";
  if (up >= low * 1.5) return "HAUT";
  if (low >= up * 1.5) return "BAS";
  return "LIBRE";
}

/** Alternance : après le haut, le bas ; après le bas (ou une séance libre, ou rien), le haut. */
export const nextKind = (last: Kind | null): "HAUT" | "BAS" => (last === "HAUT" ? "BAS" : last === "BAS" ? "HAUT" : "HAUT");

/** Sous-titre du bouton « + » et titre de la suggestion : « Haut du corps · Lafay ». Une seule source, celle de l'écran de préparation (getNextSessionSuggestion). */
export const suggestionLabel = (s: Pick<Suggestion, "title" | "draft">) =>
  s.draft.exercises.length > 0 && s.draft.exercises.every((e) => isLafayCode(e.code)) ? `${s.title} · Lafay` : s.title;
