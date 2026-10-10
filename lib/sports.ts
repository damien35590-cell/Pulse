import { Bike, Dumbbell, Footprints, Mountain, Waves, Activity, type LucideIcon } from "lucide-react";

/** Comme sur Strava : une seule couleur de marque, les sports se distinguent par leur pictogramme. */
export const SPORTS: Record<string, { label: string; icon: LucideIcon }> = {
  RUN: { label: "Course", icon: Footprints }, RIDE: { label: "Vélo", icon: Bike }, SWIM: { label: "Natation", icon: Waves },
  HIKE: { label: "Randonnée", icon: Mountain }, WALK: { label: "Marche", icon: Footprints }, WORKOUT: { label: "Musculation", icon: Dumbbell }, OTHER: { label: "Activité", icon: Activity },
};
export const sportColor = (_type?: string) => "rgb(var(--brand))";

/** Les quatre sports de l'app. */
export const MY_SPORTS = ["RUN", "RIDE", "HIKE", "WORKOUT"] as const;
