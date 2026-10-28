/**
 * Titre affiché d'une activité. Priorité : le titre que tu as saisi (renommage, saisie manuelle : `titleEdited`) gagne toujours ;
 * sinon, le nom de la séance du programme qu'elle réalise (« VMA courte · 8 × 30/30 », « Footing ») remplace un titre automatique
 * (nom du sport seul, « Morning Run », « Course à pied le midi », titres par défaut des imports) ; un titre écrit à la main ailleurs
 * (Strava…) reste. Affichage seulement, la donnée reste intacte (tests : tools/test-activity-title.ts).
 */
import { SPORTS } from "@/lib/sports";

export type TitledActivity = { title: string; titleEdited?: boolean | null; plannedSession?: { title: string } | null };

/** Minuscules, sans accents ni apostrophes, espaces simples : « Course à pied l’après-midi » → « course a pied l apres-midi ». */
const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\u2019'`]/g, " ").replace(/apres midi/g, "apres-midi").replace(/\s+/g, " ").trim();

/** Noms de sport employés seuls ou suivis d'un moment de la journée (Strava, Garmin, Google Fit, import FIT, saisie sans titre). */
const SPORT_WORDS = [
  ...Object.values(SPORTS).flatMap((s) => [s.label, s.short]),
  "course a pied", "course", "sortie a velo", "sortie velo", "sortie", "run", "ride", "walk", "hike", "workout", "trail", "trail run",
  "entrainement", "seance", "musculation", "velo virtuel", "virtual ride", "virtual run", "velotaf", "activite importee", "activite strava",
].map(norm).sort((a, b) => b.length - a.length); // le plus long d'abord : « course a pied » avant « course »
const FILLER = new Set(["le", "la", "l", "du", "de", "d", "des", "en", "a", "au", "dans", "pendant", "pause", "heure"]);
const TIME = new Set(["matin", "matinee", "matinale", "matinal", "midi", "apres-midi", "soir", "soiree", "nuit", "nocturne", "dejeuner", "aube"]);
/** Titres anglais de Strava / Intervals.icu : « Morning Run », « Lunch Weight Training ». */
const EN = /^(morning|afternoon|evening|night|lunch) (run|ride|walk|hike|swim|workout|weight training|trail run|virtual ride|virtual run|e-bike ride|ebike ride)$/;
/** Titres Garmin : « Rennes Running », « Cesson-Sévigné - Course à pied » (lieu + sport). */
const GARMIN = /^[a-z][a-z -]{1,40}? (- )?(running|course a pied|trail running|cyclisme|marche|randonnee)$/;
/** « Activité RUN » (repli des imports Google Fit). */
const TYPE_FALLBACK = /^activite [a-z]+$/;

/** Titre généré automatiquement (et non écrit par quelqu'un) ? */
export function isAutoTitle(title: string): boolean {
  const t = norm(title);
  if (!t || EN.test(t) || GARMIN.test(t) || TYPE_FALLBACK.test(t)) return true;
  const sport = SPORT_WORDS.find((w) => t === w || t.startsWith(w + " "));
  if (!sport) return false;
  const rest = t.slice(sport.length).trim().split(" ").filter(Boolean);
  // Le sport seul, ou suivi d'un moment de la journée (« du matin », « le midi », « dans l'après-midi », « en soirée »)
  return !rest.length || (rest.every((w) => FILLER.has(w) || TIME.has(w)) && rest.some((w) => TIME.has(w)));
}

/** Nom de la séance du programme à afficher à la place du titre, ou null (pas de séance, titre saisi ou écrit à la main). */
export const planTitle = (a: TitledActivity): string | null => {
  const plan = a.plannedSession?.title?.trim();
  return plan && !a.titleEdited && isAutoTitle(a.title) ? plan : null;
};
export const displayTitle = (a: TitledActivity): string => planTitle(a) ?? a.title;
