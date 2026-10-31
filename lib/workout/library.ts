/**
 * Bibliothèque de modèles (Lafay T1/T2, programmes perso, SuperPhysique : PROGRAM_TEMPLATES de catalog-data.ts)
 * → modèles de séance de l'app (WorkoutTemplate) : une séance du modèle = un modèle de séance.
 * Conversion pure, sans base de données (tests : tools/test-catalog.ts) ; l'écriture est dans library-db.ts.
 */
import { PROGRAM_TEMPLATES, type ProgramTemplate, type TemplateExercise } from "./catalog-data";
import { DEFAULT_REPS, catalogExercise, displayLabel, isVariantCode, restAfterFor } from "./catalog";
import type { Structure } from "./draft";

export const libraryTemplate = (id: string): ProgramTemplate | undefined => PROGRAM_TEMPLATES.find((t) => t.id === id);

export const SOURCE_LABEL: Record<ProgramTemplate["source"], string> = {
  lafay: "Lafay · tome 1",
  "lafay-turbo": "Lafay · tome 2 (haltères)",
  perso: "Mes programmes",
  superphysique: "SuperPhysique",
  renfo: "Renfo course",
};

/** Libellé d'une ligne de modèle : « A3 », « Rowing un bras (haltère) ». */
export function exerciseLabel(id: string): string {
  const e = catalogExercise(id);
  if (!e) return id;
  return e.code ? `${e.code} · ${e.name}` : displayLabel(e);
}

/** « 6 × 5 », « 3 × 8–12 », « 2 × max », « 3 × 30 s ». */
export function prescription(x: TemplateExercise): string {
  const timed = catalogExercise(x.exerciseId)?.mode === "time";
  const reps = x.reps == null ? "max" : x.repsMax ? `${x.reps}–${x.repsMax}` : String(x.reps);
  return `${x.sets} × ${reps}${timed && x.reps != null ? " s" : ""}`;
}

/** Une ligne de modèle → structure de séance (code Lafay + variante, ou nom de l'exercice), avec une note qui garde ce que le modèle de séance ne sait pas porter. */
export function structureOf(x: TemplateExercise): Structure {
  const e = catalogExercise(x.exerciseId);
  const timed = e?.mode === "time";
  const notes = [
    x.reps == null ? (timed ? "Le plus longtemps possible" : "Maximum de répétitions") : null,
    x.repsMax ? `Fourchette ${x.reps}–${x.repsMax}` : null,
    x.alternatives?.length ? `Au choix : ${x.alternatives.map((a) => catalogExercise(a)?.code ?? exerciseLabel(a)).join(", ")}` : null,
    x.note ?? null,
  ].filter(Boolean);
  const reps = x.reps ?? (timed ? 30 : DEFAULT_REPS);
  const restAfterSec = x.restAfterSec ?? restAfterFor(x.restSec);
  const base = { sets: x.sets, reps, restSec: x.restSec, restAfterSec, loadKg: null, note: notes.length ? notes.join(" · ").slice(0, 200) : null };
  if (e?.code) return { ...base, code: e.family, variant: isVariantCode(e.code) ? e.code : null };
  return { ...base, code: e ? displayLabel(e) : x.exerciseId, variant: null };
}

/** Noms des modèles de séance créés : « Lafay · Niveau 2 », « Hybride Lafay + SuperPhysique (A/B) · A · Haut ». */
export function sessionNames(t: ProgramTemplate): string[] {
  return t.sessions.map((s) => (t.sessions.length > 1 ? `${t.name} · ${s.name}` : t.name).slice(0, 60));
}

/** Toutes les séances d'un modèle, prêtes à enregistrer. */
export function templateStructures(t: ProgramTemplate): { name: string; structure: Structure[] }[] {
  const names = sessionNames(t);
  return t.sessions.map((s, i) => ({ name: names[i], structure: s.exercises.map(structureOf) }));
}
