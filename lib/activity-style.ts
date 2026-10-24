import type { LucideIcon } from "lucide-react";
import { SPORTS } from "@/lib/sports";

export type ActivityStyle = { icon: LucideIcon; fg: string; soft: string; dot: string; stroke: string };

// Classes écrites en toutes lettres : Tailwind ne scanne pas les noms construits.
const RUN = { fg: "text-act-run", soft: "bg-act-run-soft", dot: "bg-act-run", stroke: "stroke-act-run" };
const STRENGTH = { fg: "text-act-strength", soft: "bg-act-strength-soft", dot: "bg-act-strength", stroke: "stroke-act-strength" };
const RIDE = { fg: "text-act-ride", soft: "bg-act-ride-soft", dot: "bg-act-ride", stroke: "stroke-act-ride" };
const HIKE = { fg: "text-act-hike", soft: "bg-act-hike-soft", dot: "bg-act-hike", stroke: "stroke-act-hike" };
const OTHER = { fg: "text-act-other", soft: "bg-act-other-soft", dot: "bg-act-other", stroke: "stroke-act-other" };

/** Couleur par type d'activité (tokens act-* de globals.css). Source unique : aucun composant ne code de teinte en dur. */
const COLORS: Record<string, Omit<ActivityStyle, "icon">> = {
  RUN, WORKOUT: STRENGTH, RIDE, EBIKE: RIDE, HIKE, WALK: HIKE,
};

export function activityStyle(type?: string): ActivityStyle {
  return { icon: (SPORTS[type ?? ""] ?? SPORTS.OTHER).icon, ...((type && COLORS[type]) || OTHER) };
}
