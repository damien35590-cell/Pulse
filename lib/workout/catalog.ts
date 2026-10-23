/**
 * Exercices Lafay (une lettre = une famille, un chiffre = sa variante) et repos par défaut.
 * Les familles, variantes et échelles viennent du catalogue complet (lib/workout/catalog-data.ts, livres Lafay T1/T2).
 * Une ÉCHELLE = une sous-catégorie ordonnée d'une famille (A1 → A2 ; A3 → A6…) : c'est l'unité de progression et d'historique,
 * si bien qu'A2 et A3 peuvent figurer dans la même séance (niveaux 2 à 7 du livre).
 * Sans dépendance lourde : importé aussi par les composants client (feuille « ajouter un exercice », choix de variante).
 */
import { lafayCode } from "../muscles";
import { ALL_EXERCISES, DEFAULT_EQUIPMENT, FAMILIES, type CatalogExercise, type Equipment, type ExerciseFamily } from "./catalog-data";

/** Libellé court de chaque lettre : la forme « B2 - dips » des noms enregistrés (a → i inchangés depuis l'origine de l'app). */
export const LAFAY_LABEL: Record<string, string> = {
  a: "pompes", b: "dips", c: "tractions", d: "dips arrière", e: "flexions",
  f: "squat sauté", g: "crunch", h: "relevés de genoux", i: "tractions dos",
  j: "pompes piquées", k: "triceps", l: "pompes en rotation", m: "lombaires", n: "obliques",
  o: "crunch rotation", p: "relevé de buste", q: "pompes un bras", r: "abaissement épaules", s: "nuque",
  t: "rotations assis", u: "enroulement", v: "essuie-glace", w: "mollets", x: "rotations debout", y: "cou", z: "pont",
};

export const LAFAY_FAMILIES: ExerciseFamily[] = FAMILIES.filter((f) => f.source === "lafay" && f.letter);
const BY_ID = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
/** Fiche du catalogue d'un id (« A3 », « rowing-un-bras-haltere »). */
export const catalogExercise = (id: string | null | undefined): CatalogExercise | undefined => (id ? BY_ID.get(id) : undefined);

/** Toutes les sous-catégories ordonnées de plus d'une variante : les échelles (de la plus facile à la plus difficile). */
export const LADDERS: string[][] = LAFAY_FAMILIES.flatMap((f) => f.groups.filter((g) => g.ordered !== false && g.progression.length > 1).map((g) => g.progression));

/** Groupe d'un code Lafay : famille, index de la sous-catégorie, liste. */
function groupOf(code: string): { letter: string; index: number; codes: string[]; ordered: boolean } | null {
  const fam = LAFAY_FAMILIES.find((f) => f.letter === code.replace(/[0-9]+$/, ""));
  if (!fam) return null;
  const index = fam.groups.findIndex((g) => g.progression.includes(code));
  return index < 0 ? null : { letter: fam.letter!.toLowerCase(), index, codes: fam.groups[index].progression, ordered: fam.groups[index].ordered !== false };
}

/** Le code est-il une variante (sous-catégorie de plusieurs codes) ? « F » seul (squat sauté) n'en est pas une, « F1 » oui. */
export const isVariantCode = (v: string) => { const g = groupOf(v); return !!g && (g.codes.length > 1 || /\d$/.test(v)); };

/** Clé d'historique d'une variante : « lafay:b » pour l'échelle principale d'une lettre, « lafay:a#1 » pour les suivantes. */
export const ladderKey = (variant: string) => {
  const g = groupOf(variant);
  if (!g) return `lafay:${variant[0].toLowerCase()}`;
  return g.index === 0 ? `lafay:${g.letter}` : `lafay:${g.letter}#${g.index}`;
};

/** Variante suivante (plus difficile) de son échelle ; null en fin d'échelle ou pour des variantes sans ordre. */
export const nextInLadder = (v: string | null) => {
  const g = v ? groupOf(v) : null;
  if (!g || !g.ordered) return null;
  return g.codes[g.codes.indexOf(v!) + 1] ?? null;
};
/** Variante précédente (plus facile). */
export const prevInLadder = (v: string | null) => {
  const g = v ? groupOf(v) : null;
  if (!g || !g.ordered) return null;
  return g.codes[g.codes.indexOf(v!) - 1] ?? null;
};

export const REST_BETWEEN_S = 30;
export const REST_AFTER_S = 120;
export const DEFAULT_SETS = 6;
export const DEFAULT_REPS = 8;

export const isLafayCode = (code: string) => /^[A-Z]$/.test(code) && LAFAY_FAMILIES.some((f) => f.letter === code);
export const lafayLetters = LAFAY_FAMILIES.map((f) => f.letter!.toLowerCase());

/** Toutes les variantes d'une lettre (sous-catégories de plusieurs codes, dans l'ordre du catalogue) ; vide si elle n'en a pas. */
export const variantsOf = (code: string): string[] => {
  const fam = LAFAY_FAMILIES.find((f) => f.letter === code.toUpperCase());
  return fam ? fam.groups.filter((g) => g.progression.length > 1).flatMap((g) => g.progression) : [];
};

/** Niveau de départ quand on n'a encore jamais fait l'exercice : le premier de l'échelle principale (null si la lettre n'a pas d'échelle). */
export const defaultVariant = (code: string): string | null => {
  const fam = LAFAY_FAMILIES.find((f) => f.letter === code.toUpperCase());
  const first = fam?.groups[0];
  return first && first.progression.length > 1 ? first.progression[0] : null;
};

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
  const variant = isVariantCode(v) ? v : null;
  return { code, variant, name: lafayName(code, variant) };
}

/** Fiche catalogue d'un exercice de séance : la variante Lafay, sinon le code seul, sinon un exercice nommé (SuperPhysique). */
export function catalogFor(code: string, variant: string | null): CatalogExercise | undefined {
  if (isLafayCode(code)) return catalogExercise(variant ?? code);
  const key = code.trim().toLowerCase();
  return ALL_EXERCISES.find((e) => e.source !== "lafay" && displayLabel(e).toLowerCase() === key) ?? ALL_EXERCISES.find((e) => e.source !== "lafay" && e.name.toLowerCase() === key);
}

/** Nom enregistré d'un exercice du catalogue : « A3 - pompes » pour Lafay, « Rowing un bras (haltère) » sinon. */
export function displayLabel(e: CatalogExercise): string {
  if (e.code) return lafayName(e.family, isVariantCode(e.code) ? e.code : null);
  return e.subtitle ? `${e.name} (${e.subtitle.toLowerCase()})` : e.name;
}

// ───────── Mon matériel ─────────

/** Libellés du matériel, dans l'ordre d'affichage des réglages. « aucun » n'est pas proposé : il est toujours disponible. */
export const EQUIPMENT_LABELS: Record<Exclude<Equipment, "aucun">, string> = {
  "barres-dips": "Barres de dips (chaise romaine)",
  "barre-traction": "Barre de traction",
  chaises: "Chaises",
  support: "Tabouret, cale, marche",
  "meuble-haut": "Meuble ou rebord à ~1 m",
  mur: "Mur",
  table: "Table solide ou barre basse",
  baton: "Bâton, manche à balai",
  sangles: "Sangles",
  halteres: "Haltères",
  barre: "Barre et disques",
  banc: "Banc de musculation",
};
const ALL_EQUIPMENT = new Set<string>(["aucun", ...Object.keys(EQUIPMENT_LABELS)]);

/** Matériel enregistré → liste valide ; vide = matériel par défaut (chaise romaine + maison). « aucun » est toujours inclus. */
export function equipmentOf(saved: string[] | null | undefined): Equipment[] {
  const valid = (saved ?? []).filter((e) => ALL_EQUIPMENT.has(e)) as Equipment[];
  const list = valid.length ? valid : DEFAULT_EQUIPMENT;
  return list.includes("aucun") ? list : ["aucun", ...list];
}

/** L'exercice est-il faisable avec ce matériel ? */
export const doable = (e: Pick<CatalogExercise, "equipment">, mine: readonly Equipment[]) => e.equipment.every((x) => mine.includes(x));

/** Matériel manquant pour une liste d'exigences. */
export const missingEquipment = (req: readonly Equipment[] | undefined, mine: readonly Equipment[]) => (req ?? []).filter((x) => !mine.includes(x));
