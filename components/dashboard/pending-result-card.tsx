import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

/** Après une course : invitation à saisir le résultat. */
export function PendingResultCard({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/events/${id}`} className={cn(ui.card, ui.pressCard, "flex min-h-12 items-center gap-3 p-3")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"><Trophy className="size-5" aria-hidden /></span>
      <span className="min-w-0 flex-1 text-sm">Comment s’est passé <b>{name}</b> ? <span className="font-semibold text-brand">Ajoute ton résultat</span></span>
      <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
    </Link>
  );
}
