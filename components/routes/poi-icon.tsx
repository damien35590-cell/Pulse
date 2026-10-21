import {
  Castle, Church, Cross, Droplet, Eye, GlassWater, Landmark, Mountain, MountainSnow, Palette, Star, TowerControl, Utensils, Waves, Wind, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PoiType } from "@/lib/routes/poi";

export const POI_ICONS: Record<PoiType, LucideIcon> = {
  viewpoint: Eye, attraction: Star, artwork: Palette, picnic_site: Utensils,
  peak: Mountain, spring: Droplet, waterfall: Waves, cave_entrance: MountainSnow,
  castle: Castle, ruins: Landmark, cross: Cross, memorial: Landmark, monument: Landmark, manor: Castle, church: Church,
  archaeological_site: Landmark, historic: Landmark,
  lighthouse: TowerControl, tower: TowerControl, windmill: Wind, drinking_water: GlassWater,
};

/** Pastille d'un point d'intérêt : dans une liste, ou en repère sur la carte (`marker`). */
export function PoiIcon({ type, marker, active, className }: { type: PoiType; marker?: boolean; active?: boolean; className?: string }) {
  const Icon = POI_ICONS[type] ?? Landmark;
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-full",
        marker ? cn("size-7 cursor-pointer shadow-pop ring-2 ring-brand transition-transform", active ? "scale-125 bg-brand text-brand-ink" : "bg-surface text-brand") : "size-10 bg-surface-2 text-ink",
        className,
      )}
    >
      <Icon className={marker ? "size-4" : "size-5"} strokeWidth={2.2} aria-hidden />
    </span>
  );
}
