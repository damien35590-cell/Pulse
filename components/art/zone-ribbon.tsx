import { cn } from "@/lib/utils";
import { ZONE_BG } from "@/components/activity/zone-bar";
import type { RibbonSegment } from "@/lib/art/zone-ribbon";

/**
 * Ruban de zones (art) : 14 px sous la carte du fil, un tronçon par plage de même zone, largeur = part du temps, 2 px entre eux.
 * Décoratif (le détail est dans la fiche) : aria-hidden. Couleurs z1–z6 du thème.
 */
export function ZoneRibbon({ segments, className }: { segments: RibbonSegment[]; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-3.5 w-full gap-0.5", className)}>
      {segments.map((s, i) => (
        <span key={i} className={cn("h-full min-w-0", ZONE_BG[s.z])} style={{ flex: `${s.f} 1 0%` }} />
      ))}
    </div>
  );
}
