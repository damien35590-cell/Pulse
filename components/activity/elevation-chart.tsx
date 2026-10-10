"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ElevationChart({ data }: { data: { km: number; ele: number }[] }) {
  return (
    <div className="h-40" role="img" aria-label="Profil d’altitude">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="el" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#F24A00" stopOpacity={0.4} /><stop offset="1" stopColor="#F24A00" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="km" type="number" domain={[0, "dataMax"]} tickFormatter={(v) => `${Math.round(v)} km`} tick={{ fontSize: 11, fill: "#8A8A95" }} axisLine={false} tickLine={false} />
          <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
          <Tooltip formatter={(v) => [`${Math.round(Number(v))} m`, "Altitude"]} labelFormatter={(l) => `${Number(l).toFixed(1)} km`} contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12, color: "rgb(var(--ink))" }} />
          <Area dataKey="ele" type="monotone" stroke="#F24A00" strokeWidth={2.5} fill="url(#el)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
