"use client";

import { Award, ChevronRight } from "lucide-react";
import type { BadgeItem } from "@/lib/badges";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { useBadgeReview } from "./badge-celebration";

/** Carte d'accueil « N badges à valider » : ouvre la feuille de célébration sur le plus ancien. Masquée à 0. */
export function PendingBadgesCard({ items }: { items: BadgeItem[] }) {
  const review = useBadgeReview(items);
  const n = review.pending.length;
  return (
    <>
      {n > 0 && (
        <button
          type="button"
          onClick={() => { tap(); review.openPending(); }}
          className={cn(ui.card, ui.pressCard, "flex min-h-14 w-full items-center gap-3 p-3 text-left shadow-glow")}
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-brand-ink"><Award className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1 font-semibold">
            <span className="font-num tabular-nums">{n}</span> badge{n > 1 ? "s" : ""} à valider
          </span>
          <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
        </button>
      )}
      {review.sheet}
    </>
  );
}
