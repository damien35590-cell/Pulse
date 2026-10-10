"use client";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tip = { contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12, color: "rgb(var(--ink))" }, cursor: { fill: "rgba(138,138,149,.15)" } };
const axis = { tick: { fontSize: 11, fill: "#8A8A95" }, axisLine: false, tickLine: false } as const;

export function WeeklyBars({ data }: { data: { label: string; km: number }[] }) {
  return (
    <div className="h-44" role="img" aria-label="Distance par semaine">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} /><YAxis hide />
          <Tooltip {...tip} formatter={(v) => [`${Number(v).toFixed(1).replace(".", ",")} km`, "Distance"]} labelFormatter={(l) => `Semaine du ${l}`} />
          <Bar dataKey="km" fill="#F24A00" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const fmtPace = (p: number) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60) % 60).padStart(2, "0")} /km`;
export function PaceArea({ data }: { data: { label: string; pace: number }[] }) {
  return (
    <div className="h-40" role="img" aria-label="Allure moyenne par semaine">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs><linearGradient id="pc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F24A00" stopOpacity={0.3} /><stop offset="1" stopColor="#F24A00" stopOpacity={0} /></linearGradient></defs>
          <XAxis dataKey="label" {...axis} interval="preserveStartEnd" minTickGap={24} /><YAxis hide reversed domain={["dataMin - 0.2", "dataMax + 0.2"]} />
          <Tooltip {...tip} formatter={(v) => [fmtPace(Number(v)), "Allure"]} labelFormatter={(l) => `Semaine du ${l}`} />
          <Area dataKey="pace" type="monotone" stroke="#F24A00" strokeWidth={3} fill="url(#pc)" dot={{ r: 3, fill: "#F24A00" }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
