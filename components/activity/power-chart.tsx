"use client";
import { Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type P = { min: number; power?: number; hr?: number };

export function PowerChart({ data }: { data: P[] }) {
  const hasP = data.some((d) => d.power != null), hasH = data.some((d) => d.hr != null);
  return (
    <div className="h-44" role="img" aria-label="Puissance et fréquence cardiaque">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="min" type="number" domain={[0, "dataMax"]} tickFormatter={(v) => `${Math.round(v)} min`} tick={{ fontSize: 11, fill: "#8A8A95" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="p" hide domain={[0, "dataMax + 20"]} /><YAxis yAxisId="h" hide domain={["dataMin - 10", "dataMax + 5"]} />
          <Tooltip contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12, color: "rgb(var(--ink))" }} labelFormatter={(l) => `${Math.round(Number(l))} min`} formatter={(v, n) => [n === "power" ? `${Math.round(Number(v))} W` : `${Math.round(Number(v))} bpm`, n === "power" ? "Puissance" : "Cardio"]} />
          {hasP && <Area yAxisId="p" dataKey="power" stroke="#F24A00" strokeWidth={2} fill="#F24A00" fillOpacity={0.18} dot={false} isAnimationActive={false} />}
          {hasH && <Line yAxisId="h" dataKey="hr" stroke="#8A8A95" strokeWidth={2} dot={false} isAnimationActive={false} />}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-ink-soft">{hasP ? "Orange : puissance. " : ""}{hasH ? "Gris : fréquence cardiaque." : ""}</p>
    </div>
  );
}
