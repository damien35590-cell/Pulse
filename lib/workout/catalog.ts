/**
 * Exercices Lafay (une lettre = un exercice, un chiffre = son niveau) et repos par défaut.
 * Sans dépendance lourde : importé aussi par les composants client (feuille « ajouter un exercice », choix de variante).
 */
import { lafayCode } from "../muscles";

export const LAFAY_LABEL: Record<string, string> = {
  a: "pompes", b: "dips", c: "tractions", d: "dips arrière", e: "flexions",
  f: "squat sauté", g: "crunch", h: "relevés de genoux", i: "tractions dos",
};

/** Échelles de niveaux (de la plus facile à la plus difficile). Une lettre absente d'ici n'a pas de variantes. */
export const LADDERS: string[][] = [["B1", "B2", "B"], ["C1", "C2", "C3", "C"], ["A1", "A2"], ["A3", "A4", "A5", "A6"]];

export const REST_BETWEEN_S = 30;
export const REST_AFTER_S = 120;
export const DEFAULT_SETS = 6;
export const DEFAULT_REPS = 8;

export const isLafayCode = (code: string) => /^[A-I]$/.test(code);
export const lafayLetters = Object.keys(LAFAY_LABEL);

/** « B1 », « B2 », « B » pour la lettre b ; liste vide si l'exercice n'a pas de niveaux. */
export const variantsOf = (code: string): string[] =>
  LADDERS.filter((l) => l[0][0] === code.toUpperCase()).flat();

/** Niveau de départ quand on n'a encore jamais fait l'exercice : le premier de l'échelle. */
export const defaultVariant = (code: string): string | null => variantsOf(code)[0] ?? null;

/** « B2 - dips », « F - squat sauté » : le nom que l'app a toujours donné aux exercices Lafay. */
export const lafayName = (code: string, variant: string | null) => `${variant ?? code.toUpperCase()} - ${LAFAY_LABEL[code.toLowerCase()]}`;

export const displayName = (code: string, variant: string | null) => (isLafayCode(code) ? lafayName(code, variant) : code);

/** Repos avant l'exercice suivant : séries courtes (moins d'une minute entre séries, comme en séance Lafay) → 2 min ; sinon le repos entre séries. */
export const restAfterFor = (restSec: number) => (restSec < 60 ? Math.max(REST_AFTER_S, restSec) : restSec);

/** Nom saisi (« B2 - dips », « Développé couché ») → code, niveau et nom normalisé. */
export function resolveName(raw: string): { code: string; variant: string | null; name: string } {
  const name = raw.trim();
  const c = lafayCode(name);
  if (!c) return { code: name, variant: null, name };
  const code = c.letter.toUpperCase();
  const v = c.digits != null ? `${code}${c.digits}` : code;
  const variant = variantsOf(code).includes(v) ? v : null;
  return { code, variant, name: lafayName(code, variant) };
}
