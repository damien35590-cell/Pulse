"use client";
import { Flame, Mountain, TrendingUp, Clock, Zap } from "lucide-react";
import { tap } from "@/lib/haptics";
import type { Insight } from "@/lib/insights/types";

const ICONS = { mountain: Mountain, trend: TrendingUp, clock: Clock, flame: Flame, zap: Zap };
const TONE = { wow: "--brand", progress: "--sport-hike", fun: "--sport-ride", streak: "--sport-workout" } as const;

export function InsightCarousel({ items }: { items: Insight[] }) {
  if (!items.length) return null;
  return (
    <section aria-label="À retenir cette semaine">
      <h2 className="mb-3 font-display text-xl font-semibold">À retenir</h2>
      <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
        {items.map((it) => {
          const Icon = ICONS[it.icon], c = `rgb(var(${TONE[it.tone]}))`;
          return (
            <li key={it.id} onPointerDown={() => tap(6)} className="w-[78%] shrink-0 snap-start rounded-xl border border-line bg-surface p-4 active:scale-[.98] transition-transform">
              <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c }}><Icon className="h-6 w-6" aria-hidden /></span>
              <p className="mt-4 font-display text-3xl font-bold leading-none">{it.title}</p>
              <p className="mt-2 text-sm text-ink-soft">{it.body}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
