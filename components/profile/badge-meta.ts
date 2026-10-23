import {
  Bike, BookOpen, CalendarCheck, Clock, CloudRain, Compass, Dumbbell, Flag, Flame, Footprints, Heart, Layers,
  Moon, Mountain, Repeat, Route, Smile, Snowflake, Sparkles, Sun, Sunrise, Thermometer, Timer, TrendingUp, Trophy,
  Weight, Zap, type LucideIcon,
} from "lucide-react";
import type { BadgeIcon, Discipline } from "@/lib/badges";

export const ICONS: Record<BadgeIcon, LucideIcon> = {
  foot: Footprints, flag: Flag, mountain: Mountain, flame: Flame, clock: Clock, route: Route, bike: Bike, dumbbell: Dumbbell,
  zap: Zap, calendar: CalendarCheck, repeat: Repeat, sunrise: Sunrise, moon: Moon, sun: Sun, snow: Snowflake, rain: CloudRain,
  thermo: Thermometer, smile: Smile, heart: Heart, book: BookOpen, sparkles: Sparkles, weight: Weight, layers: Layers,
  compass: Compass, timer: Timer, trend: TrendingUp, trophy: Trophy,
};

export const DISC_LABEL: Record<Discipline, string> = { GLOBAL: "Général", RIDE: "Vélo", RUN: "Running", HIKE: "Randonnée", WORKOUT: "Musculation" };
export const TIER_COLORS = ["#b87333", "#aab2bd", "#f2b705", "#4cc9f0"];
