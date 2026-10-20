import Link from "next/link";
import { ChevronRight, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

/** Accueil : accès aux itinéraires (3 boucles selon le temps dispo). */
export function PlanRouteCard() {
  return (
    <Link href="/itineraires" className={cn(ui.card, ui.pressCard, "flex items-center gap-3 p-4")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
        <Route className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-tight text-ink">Prépare ta sortie</span>
        <span className="mt-0.5 block truncate text-xs text-ink-mute">3 boucles nature selon ton temps dispo, en GPX</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
    </Link>
  );
}
