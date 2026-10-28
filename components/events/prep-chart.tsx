"use client";
import { Area, Bar, Cell, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useThemeColors } from "@/lib/use-theme-colors";

export type PrepPoint = { start: string; km: number | null; plan: number | null; band: [number, number] | null; current: boolean; future: boolean; phase: string };
const day = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "");
const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });

function Tip({ active, payload }: { active?: boolean; payload?: { payload: PrepPoint }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-pop">
      <p className="font-semibold">Semaine du {day(p.start)}</p>
      {!p.future && <p><b>{fr(p.km ?? 0)} km</b>{p.current ? " (en cours)" : ""}</p>}
      {p.band && <p className="text-ink-soft">{p.phase} : cible {fr(p.band[0])}–{fr(p.band[1])} km</p>}
    </div>
  );
}

/** Km par semaine : 12 semaines passées en plein, semaines restantes en pointillé, zone de volume cible en fond. */
export function PrepChart({ data }: { data: PrepPoint[] }) {
  const t = useThemeColors();
  return (
    <div role="img" aria-label="Kilomètres par semaine sur 12 semaines et semaines restantes jusqu’à la course, avec la zone de volume cible">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} barCategoryGap="12%" margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="start" tickFormatter={day} tick={{ fontSize: 11, fill: t.inkMute }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis width={28} tick={{ fontSize: 11, fill: t.inkMute }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<Tip />} cursor={{ fill: t.inkMute, fillOpacity: 0.12 }} />
            <Area dataKey="band" type="step" stroke="none" fill={t.good} fillOpacity={0.16} isAnimationActive={false} connectNulls />
            <Bar dataKey="km" stackId="w" radius={[3, 3, 0, 0]} isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={t.brand} fillOpacity={d.current ? 0.55 : 0.9} />)}</Bar>
            <Bar dataKey="plan" stackId="w" fill="transparent" stroke={t.inkMute} strokeDasharray="3 3" strokeWidth={1.2} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Barres pleines : km réalisés. Pointillés : semaines à venir. Zone verte : volume cible.</p>
    </div>
  );
}
