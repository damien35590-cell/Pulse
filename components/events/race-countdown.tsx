"use client";
import { useEffect, useState } from "react";
import { getCountdown, getRaceStartDate, type RaceWhen } from "@/lib/races/time";
import { cn } from "@/lib/utils";

/** Horloge client : repart de l'heure du serveur puis avance toutes les `ms`. */
export function useNow(initial: string, ms = 1000) {
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => { setNow(new Date()); const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Compte à rebours géant : "J-161" + détail j/h/min/s qui défile. */
export function RaceCountdown({ race, now: initial, className }: { race: RaceWhen; now: string; className?: string }) {
  const now = useNow(initial), c = getCountdown(race, now);
  const fullDays = Math.floor(Math.max(0, +getRaceStartDate(race) - +now) / 864e5);
  const big = c.isToday ? "Jour J" : c.isPast ? "Terminée" : c.days === 1 ? "Demain" : `J-${c.days}`;
  const hms = `${pad(c.hours)} h ${pad(c.minutes)} min ${pad(c.seconds)} s`;
  const detail = c.isPast ? null : c.isToday ? c.label : c.days === 1 ? `${race.startTime ? `Départ ${race.startTime.replace(":", "h")} · ` : ""}dans ${fullDays ? `${fullDays} j ` : ""}${hms}` : `${fullDays} j ${hms}`;
  return (
    <div className={className}>
      <p className={cn("font-display font-bold leading-none text-brand", big.length > 6 ? "text-6xl" : "text-7xl")}>{big}</p>
      {detail && <p suppressHydrationWarning className="mt-2 text-sm font-semibold tabular-nums text-ink-soft">{c.days > 1 ? `départ dans ${detail}` : detail}</p>}
    </div>
  );
}
