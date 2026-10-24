import { Bike, Dumbbell, Footprints, Mountain, Waves, Activity, Zap, type LucideIcon } from "lucide-react";

/** Comme sur Strava : une seule couleur de marque, les sports se distinguent par leur pictogramme. */
export const SPORTS: Record<string, { label: string; icon: LucideIcon }> = {
  RUN: { label: "Running", icon: Footprints }, RIDE: { label: "Vélo", icon: Bike }, EBIKE: { label: "E-bike", icon: Zap }, SWIM: { label: "Natation", icon: Waves },
  HIKE: { label: "Randonnée", icon: Mountain }, WALK: { label: "Marche", icon: Footprints }, WORKOUT: { label: "Musculation", icon: Dumbbell }, OTHER: { label: "Activité", icon: Activity },
};
export const sportColor = (_type?: string) => "rgb(var(--brand))";
/** Teinte de l'icône d'un sport (tokens sport-*) ; les autres sports gardent la couleur du texte. */
export const sportTint = (type?: string) => type === "RUN" ? "text-sport-run" : type === "WORKOUT" ? "text-sport-strength" : type === "RIDE" ? "text-sport-bike" : "";

/** Les quatre sports de l'app. */
export const MY_SPORTS = ["WORKOUT", "RUN", "RIDE", "HIKE"] as const;

/** Ordre de priorité d'affichage des sports (filtres, sélecteurs). */
export const SPORT_ORDER = ["WORKOUT", "RUN", "RIDE", "EBIKE", "HIKE", "WALK"] as const;

/** Activités « douces » : déplacements du quotidien, pas de l'entraînement. */
export const SOFT_TYPES = ["EBIKE", "WALK"] as const;
export const isSoft = (type: string) => (SOFT_TYPES as readonly string[]).includes(type);
