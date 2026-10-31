/**
 * Données des SetBars (art d'une séance de muscu dans le fil) : un groupe par exercice (6 au plus, dans l'ordre de la séance ; une séance en compte 4 à 5), une barre par série.
 * Fonction pure (tests : tools/test-zone-ribbon.ts). Reps pour un exercice en répétitions, secondes pour un exercice « au chrono » (mode time).
 */
import { LAFAY_LABEL, catalogFor, resolveName } from "../workout/catalog";

export const MAX_GROUPS = 6;

/** Un exercice de la séance, tel que lu en base (WorkoutExercise). `reps` = cible du jour (progression Lafay), `setsDetail` = le réel. */
export type SetExercise = { name: string; sets: number; reps: number; setsDetail?: unknown };

export type SetGroup = {
  /** « B2 », « F », ou un nom de 10 caractères au plus pour un exercice hors Lafay. */
  code: string;
  /** Nom court lisible (« Dips », « Développé couché ») : sous le groupe, dans la fiche. Absent des données de démo. */
  name?: string;
  /** Exercice Lafay : `code` est alors un vrai code (« B2 »), affiché au-dessus du nom. */
  lafay?: boolean;
  /** Reps (ou secondes si `timed`) de chaque série faite. */
  sets: number[];
  /** Cible par série : celle du programme, sinon le maximum de l'exercice. */
  target: number;
  timed: boolean;
  /** Échelle de la séance pour ce mode (reps ou secondes) : la plus grande série ou cible, qui donne la barre de 56 px. */
  max: number;
};

type Detail = { reps?: unknown; done?: unknown; isWarmup?: unknown };

/** Séries faites (échauffement exclu) ; sans détail série par série, on suppose le prévu réalisé. */
function doneReps(e: SetExercise): number[] {
  if (Array.isArray(e.setsDetail) && e.setsDetail.length) {
    return (e.setsDetail as Detail[])
      .filter((s) => s && s.done !== false && !s.isWarmup && typeof s.reps === "number" && s.reps > 0)
      .map((s) => s.reps as number);
  }
  return e.sets > 0 && e.reps > 0 ? Array.from({ length: e.sets }, () => e.reps) : [];
}

/** « B2 - dips » → « B2 » ; hors Lafay, un nom lisible de 10 caractères au plus (« Développé… »), jamais des initiales. */
export const LABEL_MAX = 10;
export function exerciseCode(name: string): string {
  const { code, variant } = resolveName(name);
  if (/^[A-Z]$/.test(code)) return variant ?? code;
  const clean = name.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim() || name.trim();
  return clean.length <= LABEL_MAX ? clean : `${clean.slice(0, LABEL_MAX - 1).trimEnd()}…`;
}

/** Nom court lisible sous un groupe de la fiche : « Dips » pour « B2 - dips » (le code est déjà au-dessus), le nom complet sinon. */
export function exerciseShortName(name: string): string {
  const { code } = resolveName(name);
  const short = /^[A-Z]$/.test(code) ? (LAFAY_LABEL[code.toLowerCase()] ?? name) : name.replace(/\(.*?\)/g, " ").replace(/\s+/g, " ").trim() || name.trim();
  return short.charAt(0).toUpperCase() + short.slice(1);
}

/** Exercice « au chrono » (mode time du catalogue) : ses valeurs sont des secondes. */
export function isTimed(name: string): boolean {
  const { code, variant } = resolveName(name);
  return catalogFor(code, variant)?.mode === "time";
}

/** `limit` : 6 dans le fil (plafond de sécurité) ; la fiche montre toute la séance. */
export function setGroups(exercises: SetExercise[], limit = MAX_GROUPS): SetGroup[] {
  const rows = exercises.map((e) => ({ e, sets: doneReps(e), timed: isTimed(e.name) })).filter((r) => r.sets.length > 0);
  // Échelle par mode, sur toute la séance : des secondes de gainage ne doivent pas écraser des séries de pompes.
  const scale = { reps: 0, time: 0 };
  for (const r of rows) {
    const k = r.timed ? "time" : "reps";
    scale[k] = Math.max(scale[k], ...r.sets, r.e.reps > 0 ? r.e.reps : 0);
  }
  return rows.slice(0, limit).map((r) => ({
    code: exerciseCode(r.e.name), name: exerciseShortName(r.e.name), lafay: /^[A-Z]$/.test(resolveName(r.e.name).code), sets: r.sets, timed: r.timed,
    target: r.e.reps > 0 ? r.e.reps : Math.max(...r.sets),
    max: scale[r.timed ? "time" : "reps"],
  }));
}
