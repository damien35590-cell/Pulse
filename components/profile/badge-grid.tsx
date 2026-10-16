"use client";

import { useState } from "react";
import { Bike, CalendarCheck, Clock, Dumbbell, Flag, Flame, Footprints, Mountain, Repeat, Route, Zap, type LucideIcon } from "lucide-react";
import type { BadgeIcon, Discipline, EvaluatedBadge } from "@/lib/badges";

const ICONS: Record<BadgeIcon, LucideIcon> = {
  foot: Footprints, flag: Flag, mountain: Mountain, flame: Flame, clock: Clock, route: Route,
  bike: Bike, dumbbell: Dumbbell, zap: Zap, calendar: CalendarCheck, repeat: Repeat,
};

type Tab = "ALL" | Discipline;
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL", label: "Tous" }, { key: "RIDE", label: "Vélo" }, { key: "RUN", label: "Course" },
  { key: "HIKE", label: "Rando" }, { key: "WORKOUT", label: "Muscu" },
];
const TIER_COLORS = ["#b87333", "#aab2bd", "#f2b705"]; // bronze, argent, or
const TIER_NAMES = ["Bronze", "Argent", "Or"];

const fmt = (n: number, decimals: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals }).format(n);

export function BadgeGrid({ badges }: { badges: EvaluatedBadge[] }) {
  const [tab, setTab] = useState<Tab>("ALL");
  const list = tab === "ALL" ? badges : badges.filter((b) => b.discipline === tab);
  const earned = list.filter((b) => b.tier > 0).length;

  return (
    <section>
      <h2 className="mb-2 font-display text-xl font-bold">
        Badges <span className="font-medium text-ink-soft">({earned}/{list.length})</span>
      </h2>

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Discipline">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold ${tab === t.key ? "bg-brand text-brand-ink" : "border border-line bg-surface text-ink-soft"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ul className="grid grid-cols-2 gap-2.5">
        {list.map((b) => {
          const I = ICONS[b.icon];
          const on = b.tier > 0;
          return (
            <li key={b.id} className={`rounded-xl border border-line bg-surface p-3 ${on ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-11 w-11 place-items-center rounded-full ${on ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-soft"}`}
                  style={on ? { boxShadow: `0 0 0 2px var(--tw-ring-offset-color, transparent), 0 0 0 4px ${TIER_COLORS[b.tier - 1]}` } : undefined}
                >
                  <I className="h-5 w-5" aria-hidden />
                </span>
                <span className="flex gap-1" role="img" aria-label={on ? `Palier ${TIER_NAMES[b.tier - 1]}` : "Verrouillé"}>
                  {[1, 2, 3].map((i) => (
                    <span key={i} className="h-2 w-2 rounded-full bg-line" style={i <= b.tier ? { background: TIER_COLORS[i - 1] } : undefined} />
                  ))}
                </span>
              </div>

              <p className="mt-2 text-[13px] font-bold leading-tight">{b.name}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-ink-soft">{b.desc}</p>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round(b.progress * 100)}%` }} />
              </div>
              <p className="mt-1 text-[11px] tabular-nums text-ink-soft">
                {b.next === null ? "Palier maximum atteint" : `${fmt(b.value, b.decimals)} / ${fmt(b.next, b.decimals)} ${b.unit}`}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}