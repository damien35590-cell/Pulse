"use client";
import { useState } from "react";
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { ZONES } from "@/lib/zones";
import { cn } from "@/lib/utils";
import { useThemeColors } from "@/lib/use-theme-colors";

const rows = (sec: number[]) => {
  const tot = sec.reduce((a, b) => a + b, 0) || 1;
  return ZONES.map((z, i) => ({ name: `${z.label} ${z.name}`, pct: Math.round((sec[i] / tot) * 100), label: `${sec[i] >= 60 ? Math.round(sec[i] / 60) + " min" : sec[i] + " s"} · ${Math.round((sec[i] / tot) * 100)} %`, color: z.color }));
};

/** Temps passé dans chaque zone. `power` et `hr` : secondes par zone (6 valeurs). */
export function TimeInZones({ power, hr }: { power?: number[]; hr?: number[] }) {
  const [tab, setTab] = useState<"power" | "hr">(power ? "power" : "hr"), t = useThemeColors();
  const data = rows((tab === "power" ? power : hr) ?? new Array(6).fill(0));
  return (
    <div>
      {power && hr && (
        <div role="tablist" className="mb-2 flex gap-1 rounded-full bg-surface-2 p-1">
          {([["power", "Puissance"], ["hr", "Fréquence cardiaque"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-10 flex-1 rounded-full text-sm", tab === k ? "bg-surface font-bold shadow" : "text-ink-soft")}>{l}</button>)}
        </div>
      )}
      <div className="h-52" role="img" aria-label="Temps par zone">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis type="category" dataKey="name" width={112} tick={{ fontSize: 12, fill: t.inkMute }} axisLine={false} tickLine={false} />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]} isAnimationActive={false} minPointSize={2}>
              {data.map((d) => <Cell key={d.name} fill={d.color} />)}
              <LabelList dataKey="label" position="right" style={{ fontSize: 11, fill: t.inkMute }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
