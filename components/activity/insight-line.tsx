import { Equal, TrendingDown, TrendingUp } from "lucide-react";
import type { InsightLine as Line } from "@/lib/activity/comparables";
import { cn } from "@/lib/utils";

/** Pastille de tonalité de la comparaison (fiche et fil) : plus rapide, plus lent, dans la moyenne. */
export const INSIGHT_TONE: Record<Line["tone"], { icon: typeof Equal; cls: string }> = {
  good: { icon: TrendingUp, cls: "bg-good/15 text-good" },
  warn: { icon: TrendingDown, cls: "bg-warn/15 text-warn" },
  neutral: { icon: Equal, cls: "bg-surface-2 text-ink-soft" },
};

/** La phrase unique d'une carte du fil : même formulation et mêmes tonalités que la fiche d'activité. */
export function InsightLine({ line, className }: { line: Line; className?: string }) {
  const { icon: Icon, cls } = INSIGHT_TONE[line.tone];
  return (
    <p className={cn("flex items-center gap-2 text-sm leading-snug text-ink-soft", className)}>
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full", cls)}><Icon className="size-3" aria-hidden /></span>
      <span className="line-clamp-1">{line.text}</span>
    </p>
  );
}
