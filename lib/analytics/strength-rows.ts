/**
 * Lignes d'historique de musculation et leurs règles de base (séries faites, variante, plafond, séances Lafay).
 * Fonctions pures, sans base de données : utilisables côté téléphone (verdict de fin d'exercice du SetLogger)
 * comme côté serveur. Réexportées par lib/analytics/strength.ts.
 */
import { exerciseKey, type SetDetail } from "../exercises";
import { lafayCode } from "../muscles";
import { isVariantCode, ladderKey, nextInLadder } from "../workout/catalog";

export type StrengthRow = { activityId: string; startedAt: Date; name: string; sets: number; reps: number; loadKg: number | null; setsDetail: SetDetail[] | null };

export type Det = SetDetail & { isWarmup?: boolean };

/** Séries réellement faites, échauffement exclu. Sans détail série par série, on suppose le prévu réalisé (comme progression.ts). */
export function doneSets(r: StrengthRow): Det[] {
  if (!r.setsDetail) return Array.from({ length: r.sets }, () => ({ reps: r.reps, loadKg: r.loadKg, done: true }));
  return (r.setsDetail as Det[]).filter((s) => s.done && !s.isWarmup);
}
export const sumReps = (sets: Det[]) => sets.reduce((s, x) => s + x.reps, 0);

/**
 * Un exercice Lafay = son échelle (B1 et B2 sont le même exercice à deux niveaux ; A2 et A3 sont deux échelles distinctes
 * de la famille A, cf. lib/workout/catalog.ts) ; sinon le nom normalisé.
 */
export function groupKey(name: string) {
  const c = lafayCode(name);
  if (!c) return exerciseKey(name);
  return ladderKey(c.digits != null ? `${c.letter.toUpperCase()}${c.digits}` : c.letter.toUpperCase());
}

/** Échelles Lafay, de la plus facile à la plus difficile. Une variante change l'exercice : le compteur de blocage repart de zéro. */
export const nextVariant = (v: string | null) => nextInLadder(v);
/** « B2 » ; « B » seul quand la lettre est la forme finale d'une échelle ; null pour les autres exercices. */
export const variantOf = (name: string) => {
  const c = lafayCode(name);
  if (!c) return null;
  const v = c.digits != null ? `${c.letter.toUpperCase()}${c.digits}` : c.letter.toUpperCase();
  return isVariantCode(v) ? v : null;
};
/** Plafond de répétitions par série : 12, ou 20 pour F (squat sauté). */
export const isJump = (name: string) => lafayCode(name)?.letter === "f" || /squat.*saut/i.test(name);
export const capOf = (name: string) => (isJump(name) ? 20 : 12);

/** Une séance d'un exercice dans une variante : total de reps, cible N, toutes les séries à la cible ou plus. */
export type Entry = { variant: string | null; total: number; n: number; sets: number; met: boolean };
export function entriesOf(list: StrengthRow[]): Entry[] {
  const out: (Entry & { id: string })[] = [];
  for (const r of list) { // du plus récent au plus ancien
    const d = doneSets(r), variant = variantOf(r.name);
    if (!d.length) continue;
    const met = d.length >= r.sets && d.every((x) => x.reps >= r.reps), total = sumReps(d), same = out.find((e) => e.id === r.activityId && e.variant === variant);
    if (same) { same.total += total; same.met = same.met && met; } else out.push({ id: r.activityId, variant, total, n: r.reps, sets: r.sets, met });
  }
  return out;
}
