/** Rapproche un nom saisi librement d'un exercice du catalogue (nom ou alias), via exerciseKey. Sans accès à la base. */
import { exerciseKey, typoDistance } from "@/lib/exercises";
import { EXERCISE_CATALOG } from "@/lib/training/catalog/exercises";

export type MatchEntry = { slug: string; name: string; aliases?: string[] };
/** exact : clé identique et propre à un seul exercice → rattachement sûr. Sinon, simple suggestion à vérifier. */
export type ExerciseMatch<E extends MatchEntry> = { entry: E; exact: boolean };

export function buildMatcher<E extends MatchEntry>(entries: E[]) {
  const byKey = new Map<string, E[]>();
  for (const e of entries)
    for (const k of new Set([e.name, ...(e.aliases ?? [])].map(exerciseKey).filter(Boolean))) {
      const l = byKey.get(k);
      if (!l) byKey.set(k, [e]); else if (!l.includes(e)) l.push(e);
    }
  return (name: string): ExerciseMatch<E> | null => {
    const q = exerciseKey(name);
    if (!q) return null;
    const hit = byKey.get(q);
    if (hit) return { entry: hit[0], exact: hit.length === 1 }; // clé partagée par deux exercices : à vérifier
    let best: { e: E; d: number; gap: number } | null = null;
    for (const [k, es] of byKey) {
      const d = typoDistance(q, k);
      if (d == null) continue;
      const gap = Math.abs(k.length - q.length);
      if (!best || d < best.d || (d === best.d && gap < best.gap)) best = { e: es[0], d, gap };
    }
    return best && { entry: best.e, exact: false };
  };
}

/** Rang d'une recherche sur un nom et ses alias : 0 exact, 1 début, 2 contenu, 3 faute de frappe, -1 sans rapport. */
export function searchRank(q: string, names: string[]): number {
  let best = -1;
  for (const k of names.map(exerciseKey)) {
    const r = k === q ? 0 : k.startsWith(q) ? 1 : k.includes(q) ? 2 : typoDistance(q, k) != null ? 3 : -1;
    if (r >= 0 && (best < 0 || r < best)) best = r;
  }
  return best;
}

/** Saisie d'une séance : exercices du catalogue proches de ce qui est tapé (tout le catalogue si rien n'est tapé), hors ceux déjà dans mon historique. */
export function suggestCatalog(typed: string, historyKeys: string[] = []) {
  const q = exerciseKey(typed), mine = new Set(historyKeys);
  const fresh = EXERCISE_CATALOG.filter((e) => ![e.name, ...(e.aliases ?? [])].some((n) => mine.has(exerciseKey(n))));
  if (!q) return fresh;
  return fresh.map((e) => ({ e, r: searchRank(q, [e.name, ...(e.aliases ?? [])]) })).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r).map((x) => x.e);
}

const catalogMatcher = buildMatcher(EXERCISE_CATALOG);
/** Correspondance exacte d'abord, puis tolérance aux fautes de frappe (même règle que suggestExercises). */
export const matchExercise = (name: string) => catalogMatcher(name);
