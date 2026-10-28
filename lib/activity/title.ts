/**
 * Titre affiché d'une activité : le nom de la séance du programme quand elle en réalise une (« VMA courte · 8 × 30/30 », « Footing »),
 * sinon son propre titre. Affichage seulement, la donnée reste intacte (tests : tools/test-activity-title.ts).
 */
export type TitledActivity = { title: string; plannedSession?: { title: string } | null };

export const planTitle = (a: TitledActivity): string | null => a.plannedSession?.title?.trim() || null;
export const displayTitle = (a: TitledActivity): string => planTitle(a) ?? a.title;
