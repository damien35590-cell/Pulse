import {
  Bike, BookOpen, CalendarCheck, Clock, CloudRain, Compass, Dumbbell, Flag, Flame, Footprints, Heart, Layers,
  Moon, Mountain, Repeat, Route, Smile, Snowflake, Sparkles, Sun, Sunrise, Thermometer, Timer, TrendingUp, Trophy,
  Weight, Zap, type LucideIcon,
} from "lucide-react";
import { SPORT_LABEL } from "@/lib/sports";
import type { BadgeIcon, Discipline } from "@/lib/badges";

export const ICONS: Record<BadgeIcon, LucideIcon> = {
  foot: Footprints, flag: Flag, mountain: Mountain, flame: Flame, clock: Clock, route: Route, bike: Bike, dumbbell: Dumbbell,
  zap: Zap, calendar: CalendarCheck, repeat: Repeat, sunrise: Sunrise, moon: Moon, sun: Sun, snow: Snowflake, rain: CloudRain,
  thermo: Thermometer, smile: Smile, heart: Heart, book: BookOpen, sparkles: Sparkles, weight: Weight, layers: Layers,
  compass: Compass, timer: Timer, trend: TrendingUp, trophy: Trophy,
};

export const DISC_LABEL: Record<Discipline, string> = { GLOBAL: "Général", RIDE: SPORT_LABEL("RIDE"), RUN: SPORT_LABEL("RUN"), HIKE: SPORT_LABEL("HIKE"), WORKOUT: SPORT_LABEL("WORKOUT") };
/** Teintes brutes des paliers, pour ce qui ne lit pas les classes (confettis, halos). Le diamant est holographique. */
export const TIER_COLORS = ["#c07a3e", "#aab2bd", "#f2c230", "#7c6bff"];
export const HOLO_COLORS = ["#5cf2ff", "#7c6bff", "#ff5cd6", "#ffd45c"];
