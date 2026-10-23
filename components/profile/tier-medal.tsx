import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Paliers de badges : la couleur d'un badge, c'est son palier, jamais la marque.
 * Index 0 → 3 = Bronze, Argent, Or, Diamant. Classes écrites en entier pour que Tailwind les détecte.
 */
export const TIER_NAMES = ["Bronze", "Argent", "Or", "Diamant"];
/** Aplat du palier : barres, pastilles, segments. Le diamant est holographique. */
export const TIER_BG = ["bg-tier-bronze", "bg-tier-silver", "bg-tier-gold", "bg-holo"];
/** Texte lisible dans la teinte du palier. */
export const TIER_TEXT = ["text-tier-bronze-ink", "text-tier-silver-ink", "text-tier-gold-ink", "text-tier-diamond-ink"];
/** Pastille douce (icône du prochain palier). */
export const TIER_CHIP = [
  "bg-tier-bronze-soft text-tier-bronze-ink",
  "bg-tier-silver-soft text-tier-silver-ink",
  "bg-tier-gold-soft text-tier-gold-ink",
  "bg-tier-diamond-soft text-tier-diamond-ink",
];
const MEDAL = [
  "border-2 border-tier-bronze bg-tier-bronze-soft text-tier-bronze-ink",
  "border-2 border-tier-silver bg-tier-silver-soft text-tier-silver-ink",
  "border-2 border-tier-gold bg-tier-gold-soft text-tier-gold-ink",
];

/**
 * Médaillon d'un badge au palier `tier` (0 = pas commencé, 4 = Diamant).
 * Diamant : gemme sombre dans un anneau holographique qui tourne lentement (`ring` = épaisseur en px).
 */
export function TierMedal({ tier, icon: I, className, iconClassName, ring = 3 }: {
  tier: number; icon: LucideIcon; className?: string; iconClassName?: string; ring?: number;
}) {
  if (tier >= 4) {
    return (
      <span className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full", className)}>
        <span aria-hidden className="absolute -inset-1/4 bg-holo-ring motion-safe:animate-[spin_6s_linear_infinite]" />
        <span aria-hidden className="absolute rounded-full bg-tier-gem" style={{ inset: ring }} />
        <I className={cn("relative text-white", iconClassName)} aria-hidden />
      </span>
    );
  }
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", tier > 0 ? MEDAL[tier - 1] : "bg-surface-2 text-ink-mute", className)}>
      <I className={iconClassName} aria-hidden />
    </span>
  );
}

/** Unité accordée : « 1 semaine », « 3 semaines » ; km, m, h, kg… restent invariables. */
export function unitFor(n: number, unit: string) {
  if (Math.abs(n) >= 2 || unit.length <= 2 || !unit.endsWith("s") || unit === "mois") return unit;
  return unit.slice(0, -1);
}
