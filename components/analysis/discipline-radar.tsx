"use client";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Axis } from "@/lib/radar";
import { cn } from "@/lib/utils";

const DISCIPLINES = [
  { k: "RIDE", tab: "Vélo", name: "cyclisme", empty: "Aucune séance de vélo avec données détaillées sur 90 jours." },
  { k: "RUN", tab: "Running", name: "running", empty: "Aucune sortie running sur 90 jours." },
  { k: "HIKE", tab: "Rando", name: "randonnée", empty: "Aucune randonnée sur 90 jours." },
  { k: "WORKOUT", tab: "Muscu", name: "musculation", empty: "Aucune séance de musculation sur 90 jours." },
] as const;
type Key = (typeof DISCIPLINES)[number]["k"];

/** Suit le sport choisi en haut de la page ; sur « Tous », des onglets permettent de passer d'un profil à l'autre. */
export function DisciplineRadar({ profiles, sport }: { profiles: Record<Key, Axis[] | null>; sport: string }) {
  const fixed = DISCIPLINES.find((d) => d.k === sport);
  const [tab, setTab] = useState<Key>(DISCIPLINES.find((d) => profiles[d.k])?.k ?? "RIDE");
  const cur = fixed ?? DISCIPLINES.find((d) => d.k === tab)!, data = profiles[cur.k];
  return (
    <div>
      {!fixed && (
        <div role="tablist" aria-label="Discipline" className="flex gap-1 rounded-full bg-surface-2 p-1">
          {DISCIPLINES.map((d) => (
            <button key={d.k} role="tab" aria-selected={tab === d.k} onClick={() => setTab(d.k)} className={cn("min-h-10 flex-1 rounded-full text-sm", tab === d.k ? "bg-surface font-bold shadow" : "text-ink-soft")}>{d.tab}</button>
          ))}
        </div>
      )}
      {!data ? (
        <p className="py-8 text-center text-sm text-ink-soft">{cur.empty}</p>
      ) : (
        <>
          <div className="h-64" role="img" aria-label={`Profil ${cur.name}`}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data} outerRadius="68%">
                <PolarGrid stroke="#8A8A95" strokeOpacity={0.35} />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 11, fill: "#8A8A95" }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12, color: "rgb(var(--ink))" }} formatter={(v) => [`${v} / 100`, "Score"]} />
                <Radar dataKey="value" stroke="#F24A00" strokeWidth={2.5} fill="#F24A00" fillOpacity={0.28} isAnimationActive={false} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <ul className="divide-y divide-line text-sm">
            {data.map((a) => <li key={a.axis} className="flex items-baseline justify-between gap-3 py-2"><span>{a.axis}</span><span className="text-right text-ink-soft"><b className="font-display text-base text-ink">{a.value}</b> · {a.raw}</span></li>)}
          </ul>
          <p className="mt-2 text-xs text-ink-soft">Scores de 0 à 100 sur 90 jours, entre des repères fixes : ils servent à suivre votre évolution, pas à vous comparer.</p>
        </>
      )}
    </div>
  );
}
