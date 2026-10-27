"use client";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Metric } from "@/components/ui/metric";
import { fmtDayKey } from "@/lib/format";
import { tap } from "@/lib/haptics";
import { useThemeColors } from "@/lib/use-theme-colors";
import { cn } from "@/lib/utils";

/** Un exercice (échelle Lafay : B1 et B2 sont le même exercice) : total de reps par séance, avec la variante de chaque séance. */
export type Ladder = { key: string; name: string; variant: string | null; level: string; lastDay: string; hint: string | null; points: { day: string; reps: number; variant: string | null }[] };
/** Graduations rondes (1, 2, 5 × 10^n), 5 au plus, et domaine arrondi au pas supérieur : 0, 10, 20, 30, 40. */
function niceTicks(max: number): number[] {
  const raw = Math.max(max, 1) / 4, mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag, top = Math.ceil(Math.max(max, 1) / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}
type DotProps = { cx?: number; cy?: number; index?: number; payload?: Record<string, number | string | undefined> };

/**
 * Progression : une courbe par échelle (4 au plus, les plus récentes), total de reps par séance. L'échelle choisie est en marque, les autres en gris ;
 * un changement de variante (B1 → B2) est marqué sur la courbe choisie.
 */
export function ProgressionChart({ ladders }: { ladders: Ladder[] }) {
  const c = useThemeColors(), [sel, setSel] = useState(ladders[0]?.key);
  const cur = ladders.find((l) => l.key === sel) ?? ladders[0];
  // Une série par échelle, avec ses propres dates (axe du temps) : la courbe relie toujours ses points, même à deux. Deux séances le même jour sont additionnées.
  const series = ladders.map((l) => {
    const byDay = new Map<string, { t: number; reps: number; variant: string | null }>();
    for (const p of l.points) { const o = byDay.get(p.day); byDay.set(p.day, { t: Date.parse(p.day + "T12:00:00Z"), reps: (o?.reps ?? 0) + p.reps, variant: p.variant ?? o?.variant ?? null }); }
    const pts = [...byDay.values()].sort((x, y) => x.t - y.t);
    return pts.map((p, j) => ({ ...p, mark: j > 0 && p.variant && p.variant !== pts[j - 1].variant ? (pts[j - 1].variant ? `${pts[j - 1].variant}→${p.variant}` : p.variant) : undefined }));
  });
  // Séances distinctes (jours) de l'exercice choisi : une courbe n'a de sens qu'à partir de 2.
  const curDays = new Set(cur.points.map((p) => p.day)).size;
  const all = series.flat(), DAY = 864e5, ticks = niceTicks(Math.max(...all.map((p) => p.reps)));
  const tick = { fontSize: 11, fill: c.inkMute };
  // La courbe choisie est tracée en dernier : elle passe au-dessus des autres
  const order = ladders.map((_, i) => i).sort((x, y) => Number(ladders[x].key === cur.key) - Number(ladders[y].key === cur.key));
  return (
    <div className="space-y-4">
      {ladders.length > 1 && (
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Exercice">
          {ladders.map((l) => (
            <button key={l.key} type="button" role="tab" aria-selected={l.key === cur.key} onClick={() => { if (l.key !== cur.key) { tap(6); setSel(l.key); } }}
              className={cn("inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold touch-manipulation", l.key === cur.key ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft")}>
              {l.name}
            </button>
          ))}
        </div>
      )}
      {curDays < 2 ? (
        <p className="rounded-tile bg-surface-2 px-4 py-6 text-center text-sm text-ink-soft">Courbe disponible à partir de 2 séances.</p>
      ) : (
      <div className="h-48" role="img" aria-label="Total de répétitions par séance, par exercice">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 16, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={c.inkMute} strokeOpacity={0.2} vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={[Math.min(...all.map((p) => p.t)) - DAY, Math.max(...all.map((p) => p.t)) + DAY]} tickFormatter={(t) => fmtDayKey(new Date(t).toISOString().slice(0, 10))} tick={tick} axisLine={false} tickLine={false} tickCount={4} />
            <YAxis tick={tick} axisLine={false} tickLine={false} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} />
            <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink }} labelFormatter={(t) => fmtDayKey(new Date(Number(t)).toISOString().slice(0, 10))} formatter={(v, n) => [`${v} reps`, n]} />
            {order.map((i) => {
              const l = ladders[i], on = l.key === cur.key, color = on ? c.brandText : c.inkMute;
              return (
                <Line key={l.key} name={l.name} data={series[i]} dataKey="reps" type="linear" stroke={color} strokeWidth={on ? 3 : 1.5} strokeOpacity={on ? 1 : 0.6} isAnimationActive={false}
                  dot={(p: DotProps) => (
                    <g key={p.index}>
                      <circle cx={p.cx} cy={p.cy} r={on ? 3.5 : 2} fill={color} stroke={color} />
                      {on && p.payload?.mark && <text x={p.cx} y={(p.cy ?? 0) - 9} textAnchor="middle" fontSize={10} fontWeight={600} fill={c.inkSoft}>{String(p.payload.mark)}</text>}
                    </g>
                  )}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      )}
      <dl className="grid grid-cols-3 gap-3">
        <Metric label="Cible" value={cur.level} size="md" />
        <Metric label="Variante" value={cur.variant ?? "–"} size="md" tone={cur.variant ? "default" : "soft"} />
        <Metric label="Dernière" value={fmtDayKey(cur.lastDay)} size="md" />
      </dl>
      {cur.hint && <p className="text-sm text-ink-soft">{cur.hint.charAt(0).toUpperCase() + cur.hint.slice(1)}.</p>}
    </div>
  );
}
