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

const catalogMatcher = buildMatcher(EXERCISE_CATALOG);
/** Correspondance exacte d'abord, puis tolérance aux fautes de frappe (même règle que suggestExercises). */
export const matchExercise = (name: string) => catalogMatcher(name);
