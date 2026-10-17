import Link from "next/link";
import { ChevronRight, Plus, Trophy } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { fmtRaceDay, fmtRaceDistance } from "@/lib/races/format";
import { cn } from "@/lib/utils";
import type { PrepState } from "@/lib/races/prep";

export type EventView = {
  id: string; name: string; date: Date; startTime: string | null; sport: string; targetDistance: number | null; targetElevation: number | null;
  days: number; label: string; short: string; prep: string; state: PrepState;
};

const soonText = (d: number) => (d === 0 ? "C’est aujourd’hui 🔥" : d === 1 ? "C’est demain 🔥" : `C’est dans ${d} jours 🔥`);
const DOT: Record<PrepState, string> = { "En avance": "bg-[#22C55E]", "Dans le rythme": "bg-brand", "À relancer": "bg-amber-500" };

export function EventTimeline({ events, pendingResult }: { events: EventView[]; pendingResult: { id: string; name: string } | null }) {
  const [next, ...others] = events;
  const hot = !!next && next.days <= 7;
  return (
    <section aria-label="Courses" className="space-y-2.5">
      <div className="flex items-baseline justify-between"><h2 className="font-display text-xl font-bold">Prochaine course</h2><Link href="/events" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">Toutes<ChevronRight className="h-4 w-4" aria-hidden /></Link></div>

      {pendingResult && (
        <Link href={`/events/${pendingResult.id}`} className="flex items-center gap-3 rounded-xl border border-brand/40 bg-brand/5 p-3 active:scale-[.99]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand/15 text-brand"><Trophy className="h-[18px] w-[18px]" aria-hidden /></span>
          <span className="min-w-0 flex-1 text-sm">Comment s’est passé <b>{pendingResult.name}</b> ? <span className="font-semibold text-brand">Ajoute ton résultat</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        </Link>
      )}

      {!next ? (
        <Link href="/events?import=1" className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface p-4 active:scale-[.99]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><Plus className="h-5 w-5" aria-hidden /></span>
          <span className="min-w-0 flex-1"><b className="block">Ajoute ta prochaine course</b><span className="text-sm text-ink-soft">Colle un lien NextRun ou Klikego</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
        </Link>
      ) : (
        <Link href={`/events/${next.id}`} className={cn("block rounded-xl p-4 transition active:scale-[.99]", hot ? "bg-brand text-white shadow-md shadow-brand/20" : "border border-line bg-surface hover:border-brand/40")}>
          {hot && <p className="mb-1 text-sm font-bold">{soonText(next.days)}</p>}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold leading-tight">{next.name}</p>
              <p className={cn("text-sm first-letter:uppercase", hot ? "text-white/85" : "text-ink-soft")}>{fmtRaceDay(next.date, false)}{next.startTime ? ` · ${next.startTime.replace(":", "h")}` : ""}</p>
              <p className={cn("text-sm", hot ? "text-white/85" : "text-ink-soft")}>{[next.targetDistance ? fmtRaceDistance(next.targetDistance) : null, next.targetElevation ? `${Math.round(next.targetElevation)} m D+` : null, SPORTS[next.sport]?.label].filter(Boolean).join(" · ")}</p>
            </div>
            <p className={cn("shrink-0 font-display text-4xl font-bold leading-none", !hot && "text-brand")}>{next.days === 0 ? "Jour J" : `J-${next.days}`}</p>
          </div>
          <p className={cn("mt-3 flex items-center gap-2 truncate text-[13px] font-semibold", hot ? "text-white/90" : "text-ink-soft")}>
            <span className={cn("h-2 w-2 shrink-0 rounded-full", hot ? "bg-white" : DOT[next.state])} aria-hidden />{next.prep}
          </p>
        </Link>
      )}

      {others.length > 0 && (
        <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
          {others.map((e) => (
            <li key={e.id} className="w-40 shrink-0">
              <Link href={`/events/${e.id}`} className="block h-full rounded-xl border border-line bg-surface p-3 transition hover:border-brand/40 active:scale-[.98] active:bg-surface-2">
                <p className="font-display text-2xl font-bold text-brand">{e.short}</p><p className="truncate font-semibold">{e.name}</p><p className="text-xs first-letter:uppercase text-ink-soft">{fmtRaceDay(e.date, false)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
