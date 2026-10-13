"use client";
import { useState } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import type { Axis } from "@/lib/radar";
import { cn } from "@/lib/utils";

export function DisciplineRadar({ cycling, running }: { cycling: Axis[] | null; running: Axis[] | null }) {
  const [tab, setTab] = useState<"cycling" | "running">(!cycling && running ? "running" : "cycling");
  const data = tab === "cycling" ? cycling : running;
  return (
    <div>
      <div role="tablist" aria-label="Discipline" className="flex gap-1 rounded-full bg-surface-2 p-1">
        {([["cycling", "Cyclisme"], ["running", "Course à pied"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-10 flex-1 rounded-full text-sm", tab === k ? "bg-surface font-bold shadow" : "text-ink-soft")}>{l}</button>
        ))}
      </div>
      {!data ? (
        <p className="py-8 text-center text-sm text-ink-soft">{tab === "cycling" ? "Aucune séance de vélo avec données détaillées sur 90 jours." : "Aucune course sur 90 jours."}</p>
      ) : (
        <>
          <div className="h-64" role="img" aria-label={`Profil ${tab === "cycling" ? "cyclisme" : "course"}`}>
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
