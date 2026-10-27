// Convention de nommage : « Running » = le sport (type RUN) ; « Course » = une course / compétition (événement).
import { Bike, Dumbbell, Footprints, Mountain, Waves, Activity, Zap, type LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { Runner } from "@/components/ui/icons/runner";

export type SportIcon = ComponentType<LucideProps>;

/** Comme sur Strava : une seule couleur de marque, les sports se distinguent par leur pictogramme. */
export const SPORTS: Record<string, { label: string; short: string; icon: SportIcon }> = {
  RUN: { label: "Running", short: "Running", icon: Runner }, RIDE: { label: "Vélo", short: "Vélo", icon: Bike }, EBIKE: { label: "E-bike", short: "E-bike", icon: Zap }, SWIM: { label: "Natation", short: "Natation", icon: Waves },
  HIKE: { label: "Randonnée", short: "Rando", icon: Mountain }, WALK: { label: "Marche", short: "Marche", icon: Footprints }, WORKOUT: { label: "Musculation", short: "Muscu", icon: Dumbbell }, OTHER: { label: "Activité", short: "Activité", icon: Activity },
};
/** Libellés des sports : complet (SPORT_LABEL) et court pour onglets et puces (SPORT_SHORT). Source unique, RUN = « Running ». */
export const SPORT_LABEL = (type: string) => SPORTS[type]?.label ?? SPORTS.OTHER.label;
export const SPORT_SHORT = (type: string) => SPORTS[type]?.short ?? SPORTS.OTHER.short;
export const sportColor = (_type?: string) => "rgb(var(--brand))";

/** Les quatre sports de l'app. */
export const MY_SPORTS = ["WORKOUT", "RUN", "RIDE", "HIKE"] as const;

/** Ordre de priorité d'affichage des sports (filtres, sélecteurs). */
export const SPORT_ORDER = ["WORKOUT", "RUN", "RIDE", "EBIKE", "HIKE", "WALK"] as const;

/** Activités « douces » : déplacements du quotidien, pas de l'entraînement. */
export const SOFT_TYPES = ["EBIKE", "WALK"] as const;
export const isSoft = (type: string) => (SOFT_TYPES as readonly string[]).includes(type);

/**
 * LA règle des activités douces (accueil, Analyse, coach, Comparer) : vélotafs (E-bike) et marches du quotidien, jamais une course.
 * Un vélo « vélotaf » non encore reclassé en E-bike (import Google Fit, titre explicite) compte aussi ; la source seule ne suffit pas :
 * Google Fit détecte aussi de vraies courses (source « google-fit », type RUN).
 */
export const isSoftActivity = (a: { type: string; source?: string | null; dedupeKey?: string | null; title?: string | null }) =>
  isSoft(a.type) || (a.type === "RIDE" && (a.source === "google-fit" || !!a.dedupeKey?.startsWith("gfit-") || /v[ée]lotaf/i.test(a.title ?? "")));

/**
 * LA règle du « nombre de séances » (totaux de la page Vous, compteur des Activités) : les quatre sports de l'app, activités douces exclues.
 * Natation et « autre » ne sont pas listés dans Activités : ils ne comptent pas non plus ailleurs.
 */
export const isTrainingActivity = (a: { type: string; source?: string | null; dedupeKey?: string | null; title?: string | null }) =>
  (MY_SPORTS as readonly string[]).includes(a.type) && !isSoftActivity(a);
