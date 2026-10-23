/** Types partagés de la préparation d'une séance de muscu. Sans dépendance : utilisables côté client comme côté serveur. */

export type Kind = "HAUT" | "BAS" | "LIBRE";

/** La dernière fois qu'on a fait l'exercice : reps série par série et total. */
export type LastTime = { date: string; variant: string | null; reps: number[]; total: number; loadKg: number | null };

export type DraftExercise = {
  /** Identifiant local (clé React) ; n'a aucun sens en base. */
  id: string;
  /** Lettre Lafay en majuscule (« B »), ou le nom de l'exercice quand il n'est pas Lafay. */
  code: string;
  /** « B2 » ; null hors échelle Lafay. */
  variant: string | null;
  name: string;
  sets: number;
  /** Répétitions visées par série, calculées d'après la dernière fois (lib/workout/lafay.ts). */
  reps: number;
  /** Repos entre deux séries, en secondes. */
  restSec: number;
  /** Repos avant l'exercice suivant, en secondes. */
  restAfterSec: number;
  loadKg: number | null;
  note: string | null;
  last: LastTime | null;
  /** Pourquoi cette cible : « passe à B2 à 6×7 », « saute plus haut »… */
  hint: string | null;
};

export type Draft = { title: string; kind: Kind; templateId: string | null; exercises: DraftExercise[] };

export type Suggestion = {
  kind: Exclude<Kind, "LIBRE">;
  title: string;
  /** « Dernière séance : bas du corps, il y a 2 jours » */
  reason: string;
  draft: Draft;
};

export type RecentSession = { id: string; title: string; kind: Kind; date: string; totalReps: number; exercises: number };
export type TemplateItem = { id: string; name: string; kind: Kind; isBuiltIn: boolean; exercises: number };
export type StartOptions = { suggestion: Suggestion | null; recent: RecentSession[]; templates: TemplateItem[] };
