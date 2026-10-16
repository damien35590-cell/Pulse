import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { fmtDuration, fmtKm } from "@/lib/format";

type A = { id: string; type: string; title: string; startedAt: Date; distanceM: number; movingTimeS: number };

/** Activité douce (E-bike, marche) : une ligne compacte au lieu d'une carte. */
export function SoftRow({ a, tz = "Europe/Paris" }: { a: A; tz?: string }) {
  const Icon = (SPORTS[a.type] ?? SPORTS.OTHER).icon;
  const when = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(a.startedAt);
  return (
    <Link href={`/activities/${a.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors active:bg-surface-2">
      <Icon className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">{a.title}</p>
        <p className="truncate text-[11px] capitalize text-ink-soft">{when}</p>
      </div>
      {a.distanceM > 0 && <p className="shrink-0 text-xs tabular-nums text-ink-soft">{fmtKm(a.distanceM)} km</p>}
      <p className="min-w-14 shrink-0 text-right font-display text-base font-bold tabular-nums">{fmtDuration(a.movingTimeS)}</p>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft/60" aria-hidden />
    </Link>
  );
}
