import { cn } from "@/lib/utils";
import { ZONE_BG } from "@/components/activity/zone-bar";
import type { RibbonSegment, RibbonZone } from "@/lib/art/zone-ribbon";

/** Hauteur de la barre de chaque zone, en part de la bande (26 à 94 px sur 96 px). */
const HEIGHT: Record<RibbonZone, string> = { 1: "27%", 2: "42%", 3: "56%", 4: "71%", 5: "85%", 6: "98%" };

/**
 * Profil d'effort (art) : les mêmes données que le ruban, dessinées en horizon sur fond viz-ride-bg (suit le thème). 96 px de haut, barres alignées en bas,
 * hauteur = zone, 2 px entre elles. `label` (« 10×400 ») : celui de la séance prévue liée, jamais inventé. Décoratif : aria-hidden.
 * `mini` : vignette de 52 × 32 px sur art-run-bg (page Programme : forme prévue d'une séance), sans étiquette.
 */
export function EffortStrip({ segments, label, mini, className }: { segments: RibbonSegment[]; label?: string; mini?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("relative flex w-full items-end overflow-hidden", mini ? "h-8 w-[52px] shrink-0 gap-px rounded-tile bg-art-run-bg opacity-60" : "h-24 gap-0.5 border-t border-line bg-viz-ride-bg dark:border-t-0", className)}>
      {segments.map((s, i) => (
        <span key={i} className={cn("min-w-0", ZONE_BG[s.z])} style={{ flex: `${s.f} 1 0%`, height: HEIGHT[s.z] }} />
      ))}
      {!mini && label && <span className="absolute left-4 top-3 font-num text-art-label tabular-nums text-viz-ride-ink">{label}</span>}
    </div>
  );
}
