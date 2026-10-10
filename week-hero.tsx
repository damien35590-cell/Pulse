"use client";
import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "framer-motion";
import { fmtNum } from "@/lib/format";
import { sportColor } from "@/lib/sports";

type Day = { key: string; label: string; km: number; type: string | null; today: boolean };

export function WeekHero({ km, days }: { km: number; days: Day[] }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const max = Math.max(...days.map((d) => d.km), 1);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (reduce) { el.textContent = fmtNum(km); return; }
    const c = animate(0, km, { duration: 0.9, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => { el.textContent = fmtNum(v); } });
    return () => c.stop();
  }, [km, reduce]);

  return (
    <section aria-label="Distance de la semaine">
      <p className="font-display leading-none">
        <span ref={ref} className="text-[96px] font-bold tracking-tight tabular-nums">0</span>
        <span className="ml-1.5 text-[26px] font-semibold text-ink-soft">km</span>
      </p>
      <div className="mt-5 grid h-24 grid-cols-7 items-end gap-2">
        {days.map((d, i) => (
          <div key={d.key} className="flex h-full flex-col items-center justify-end gap-1.5">
            <motion.div
              className="w-full rounded-lg bg-surface-2"
              style={d.km > 0 ? { background: sportColor(d.type ?? "OTHER") } : undefined}
              initial={{ height: 6 }}
              animate={{ height: d.km > 0 ? `${Math.max(12, (d.km / max) * 100)}%` : 6 }}
              transition={{ delay: 0.05 * i, duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            />
            <span className={d.today ? "text-xs font-semibold" : "text-xs text-ink-soft"}>{d.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
