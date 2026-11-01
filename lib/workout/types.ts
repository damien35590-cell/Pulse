/** Types partagés de la préparation d'une séance de muscu. Sans dépendance : utilisables côté client comme côté serveur. */

export type Kind = "HAUT" | "BAS" | "LIBRE";

/** La dernière fois qu'on a fait l'exercice : reps série par série et total. */
export type LastTime = { date: string; variant: string | null; reps: number[]; total: number; loadKg: number | null };

/** Une séance passée d’un exercice Lafay, juste ce qu’il faut pour rejouer la règle de progression sur le téléphone (fin d’exercice du SetLogger). */
export type PastRow = { activityId: string; name: string; sets: number; reps: number; setsDetail: { reps: number; done: boolean }[] | null };

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
  /** Lafay : séances précédentes de l’échelle (6 au plus, de la plus récente à la plus ancienne). */
  past?: PastRow[];
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

/** Une ligne de l'éditeur de modèle (lecture et enregistrement). */
export type TemplateEditRow = {
  /** Clé React locale. */
  key: string;
  /** Identifiant de la ligne en base ; absent pour un exercice ajouté dans l'éditeur. */
  rowId?: string;
  /** Lettre Lafay en majuscule, ou nom de l'exercice quand il n'est pas Lafay. */
  code: string;
  variant: string | null;
  /** Niveau à l'ouverture de l'éditeur : s'il change, le choix est enregistré comme choix manuel (WorkoutTemplateExercise.variantSetAt). */
  baseVariant: string | null;
  sets: number;
  /** Répétitions visées par série, ou secondes pour un exercice chronométré. */
  reps: number;
  restSec: number;
  restAfterSec: number;
  loadKg: number | null;
  note: string | null;
  /** Ce que viserait la prochaine séance d'après l'historique (priorité sur les reps du modèle) ; lecture seule. */
  next?: { variant: string | null; reps: number } | null;
};
export type TemplateEdit = { id: string; name: string; isBuiltIn: boolean; rows: TemplateEditRow[] };
