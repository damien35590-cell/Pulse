"use client";
import { useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type Band = { from: number; to: number; className: string; label?: string };

type Props = {
  /** Échantillons à intervalle régulier (ex. FC toutes les 5 s). */
  values: number[];
  unit: string;
  /** Aria : ce que montre la courbe. */
  label: string;
  /** Classe text-* : la courbe et son dégradé suivent currentColor. */
  color?: string;
  height?: number;
  /** Bandes de fond (zones cardio) : className = "bg-z4"… */
  bands?: Band[];
  /** Dégradé sous la courbe (désactivé conseillé quand il y a des bandes de zones). */
  area?: boolean;
  /** Graduations sous la courbe (ex. ["0'", "10'", "20'"]). */
  ticks?: string[];
  format?: (v: number) => string;
  /** Position sous le doigt (0 → 1) en texte, ex. « 23:40 » ou « km 4,8 ». */
  at?: (frac: number) => string;
  className?: string;
};

/**
 * Courbe interactive en SVG pur : glisser le doigt affiche la valeur exacte (le défilement vertical reste libre).
 * Moyenne en pointillés, bandes de zones en fond, aucune dépendance.
 */
export function TraceChart({ values, unit, label, color = "text-brand", height = 140, bands, area = true, ticks, format = (v) => String(Math.round(v)), at, className }: Props) {
  const id = useId().replace(/:/g, "");
  const box = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  const g = useMemo(() => {
    // Ré-échantillonnage à 160 points max (moyenne par paquet) : tracé lisse, rendu rapide.
    const n = Math.min(160, values.length), size = values.length / n, pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * size), b = Math.max(a + 1, Math.floor((i + 1) * size));
      let s = 0;
      for (let j = a; j < b; j++) s += values[j];
      pts.push(s / (b - a));
    }
    const min = Math.min(...values), max = Math.max(...values), avg = values.reduce((s, v) => s + v, 0) / values.length;
    const pad = (max - min) * 0.14 || 1, lo = min - pad, hi = max + pad;
    const y = (v: number) => 100 - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100;
    const d = pts.map((v, i) => `${i ? "L" : "M"}${((i / (n - 1)) * 100).toFixed(2)},${y(v).toFixed(2)}`).join("");
    return { pts, min, max, avg, y, d, area: `${d}L100,100L0,100Z` };
  }, [values]);

  const last = g.pts.length - 1;
  const gutter = bands?.some((b) => b.label); // étiquettes de zones dans une marge à droite : jamais sur la courbe
  const value = cursor != null ? g.pts[cursor] : null;
  const move = (e: React.PointerEvent) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setCursor(Math.round(f * last));
  };

  return (
    <figure className={cn("select-none", className)}>
      <figcaption className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <span className="flex min-w-0 items-baseline gap-1">
          <span className="font-num text-metric-md tabular-nums text-ink">{format(value ?? g.avg)}</span>
          <span className="text-xs font-medium text-ink-soft">{unit}</span>
          <span className="ml-1 truncate text-xs text-ink-mute">{cursor != null ? at?.(cursor / last) ?? "" : "moyenne"}</span>
        </span>
        <span className="shrink-0 font-num text-xs tabular-nums text-ink-mute">
          min {format(g.min)} · max {format(g.max)}
        </span>
      </figcaption>
      <div
        role="img"
        aria-label={`${label} : moyenne ${format(g.avg)} ${unit}, minimum ${format(g.min)}, maximum ${format(g.max)}`}
        className={cn("relative touch-pan-y overflow-hidden rounded-xl", color)}
        style={{ height }}
        onPointerDown={move}
        onPointerMove={(e) => { if (e.pointerType === "mouse" || e.buttons) move(e); }}
        onPointerLeave={() => setCursor(null)}
        onPointerUp={(e) => { if (e.pointerType !== "mouse") setCursor(null); }}
        onPointerCancel={() => setCursor(null)}
      >
        {bands?.map((b) => {
          const top = g.y(b.to), bottom = g.y(b.from);
          if (bottom - top <= 0) return null;
          return (
            <div key={b.from} aria-hidden className="absolute inset-x-0" style={{ top: `${top}%`, height: `${bottom - top}%` }}>
              <div className={cn("absolute inset-0 opacity-[0.12]", b.className)} />
              {b.label && bottom - top >= 8 && (
                <span className="absolute right-1 top-1/2 -translate-y-1/2 font-num text-[11px] font-bold text-ink-mute">{b.label}</span>
              )}
            </div>
          );
        })}
        <div ref={box} className={cn("absolute inset-y-0 left-0", gutter ? "right-7" : "right-0")}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <defs>
              <linearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="currentColor" stopOpacity="0.32" />
                <stop offset="1" stopColor="currentColor" stopOpacity="0" />
              </linearGradient>
            </defs>
            {area && <path d={g.area} fill={`url(#fill${id})`} />}
            <path d={g.d} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div aria-hidden className="absolute inset-x-0 border-t border-dashed border-ink/25" style={{ top: `${g.y(g.avg)}%` }} />
          {value != null && cursor != null && (
            <>
              <div aria-hidden className="absolute inset-y-0 w-px bg-ink/70" style={{ left: `${(cursor / last) * 100}%` }} />
              <div
                aria-hidden
                className="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg bg-current"
                style={{ left: `${(cursor / last) * 100}%`, top: `${g.y(value)}%` }}
              />
            </>
          )}
        </div>
      </div>
      {ticks && (
        <div className={cn("mt-2 flex justify-between px-0.5 font-num text-[11px] tabular-nums text-ink-mute", gutter && "mr-7")} aria-hidden>
          {ticks.map((t, i) => <span key={i}>{t}</span>)}
        </div>
      )}
    </figure>
  );
}
