import { cn } from "@/lib/utils";
import { ZONE_BG } from "@/components/activity/zone-bar";
import type { RibbonSegment, RibbonZone } from "@/lib/art/zone-ribbon";

/** Hauteur de la barre de chaque zone (px) dans la bande de 96 px. */
const HEIGHT: Record<RibbonZone, number> = { 1: 26, 2: 40, 3: 54, 4: 68, 5: 82, 6: 94 };

/**
 * Profil d'effort (art) : les mêmes données que le ruban, dessinées en horizon sur fond viz-ride-bg (suit le thème). 96 px de haut, barres alignées en bas,
 * hauteur = zone, 2 px entre elles. `label` (« 10×400 ») : celui de la séance prévue liée, jamais inventé. Décoratif : aria-hidden.
 */
export function EffortStrip({ segments, label, className }: { segments: RibbonSegment[]; label?: string; className?: string }) {
  return (
    <div aria-hidden className={cn("relative flex h-24 w-full items-end gap-0.5 overflow-hidden bg-viz-ride-bg", className)}>
      {segments.map((s, i) => (
        <span key={i} className={cn("min-w-0", ZONE_BG[s.z])} style={{ flex: `${s.f} 1 0%`, height: HEIGHT[s.z] }} />
      ))}
      {label && <span className="absolute left-4 top-3 font-num text-art-label tabular-nums text-viz-ride-ink">{label}</span>}
    </div>
  );
}
