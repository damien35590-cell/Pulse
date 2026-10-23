import Link from "next/link";
import { ChevronRight, Plus, Trophy } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { fmtRaceDay, fmtRaceDistance } from "@/lib/races/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { Section } from "@/components/ui/section";
import type { PrepState } from "@/lib/races/prep";

export type EventView = {
  id: string; name: string; date: Date; startTime: string | null; sport: string; targetDistance: number | null; targetElevation: number | null;
  days: number; label: string; short: string; prep: string; state: PrepState;
};

const soonText = (d: number) => (d === 0 ? "C’est aujourd’hui 🔥" : d === 1 ? "C’est demain 🔥" : `C’est dans ${d} jours 🔥`);
const DOT: Record<PrepState, string> = { "En avance": "bg-good", "Dans le rythme": "bg-brand", "À relancer": "bg-warn" };

export function EventTimeline({ events, pendingResult }: { events: EventView[]; pendingResult: { id: string; name: string } | null }) {
  const [next, ...others] = events;
  const hot = !!next && next.days <= 7;
  return (
    <Section title="Courses à venir" action={<Link href="/events" className="text-sm font-semibold text-brand active:opacity-60">Toutes</Link>}>

      {pendingResult && (
        <Link href={`/events/${pendingResult.id}`} className={cn(ui.card, ui.pressCard, "flex items-center gap-3 p-3")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><Trophy className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1 text-sm">Comment s’est passé <b>{pendingResult.name}</b> ? <span className="font-semibold text-brand">Ajoute ton résultat</span></span>
          <ChevronRight className="size-4 shrink-0 text-brand" aria-hidden />
        </Link>
      )}

      {!next ? (
        <Link href="/events?import=1" className={cn(ui.card, ui.pressCard, "flex items-center gap-3 p-4")}>
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><Plus className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1"><b className="block">Ajoute ta prochaine course</b><span className="text-sm text-ink-soft">Colle un lien NextRun ou Klikego</span></span>
          <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
        </Link>
      ) : (
        <Link href={`/events/${next.id}`} className={cn(hot ? "block rounded-card bg-brand p-4 text-brand-ink transition duration-150 ease-snappy active:scale-[0.985]" : cn(ui.card, ui.pressCard, "block p-4"))}>
          {hot && <p className="mb-1 text-sm font-bold">{soonText(next.days)}</p>}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight">{next.name}</p>
              <p className={cn("text-sm first-letter:uppercase", hot ? "text-brand-ink/80" : "text-ink-soft")}>{fmtRaceDay(next.date, false)}{next.startTime ? ` · ${next.startTime.replace(":", "h")}` : ""}</p>
              <p className={cn("text-sm", hot ? "text-brand-ink/80" : "text-ink-soft")}>{[next.targetDistance ? fmtRaceDistance(next.targetDistance) : null, next.targetElevation ? `${Math.round(next.targetElevation)} m D+` : null, SPORTS[next.sport]?.label].filter(Boolean).join(" · ")}</p>
            </div>
            <p className={cn("shrink-0 font-num text-metric-xl tabular-nums leading-none", !hot && "text-brand")}>{next.days === 0 ? "Jour J" : `J-${next.days}`}</p>
          </div>
          <p className={cn("mt-3 flex items-center gap-2 truncate text-[13px] font-semibold", hot ? "text-brand-ink/90" : "text-ink-soft")}>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", hot ? "bg-brand-ink" : DOT[next.state])} aria-hidden />{next.prep}
          </p>
        </Link>
      )}

      {others.length > 0 && (
        <ul className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4">
          {others.map((e) => (
            <li key={e.id} className="w-40 shrink-0">
              <Link href={`/events/${e.id}`} className={cn(ui.card, ui.pressCard, "block h-full p-3")}>
                <p className="font-num text-metric-md tabular-nums text-brand">{e.short}</p><p className="truncate text-[15px] font-semibold">{e.name}</p><p className="text-xs first-letter:uppercase text-ink-mute">{fmtRaceDay(e.date, false)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
