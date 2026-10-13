"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DURATION_LABELS } from "@/lib/power";

export function PowerCurveChart({ record, recent }: { record: (number | null)[]; recent: (number | null)[] }) {
  const data = DURATION_LABELS.map((label, i) => ({ label, record: record[i], recent: recent[i] }));
  return (
    <div className="h-56" role="img" aria-label="Courbe de puissance : record absolu et 30 derniers jours">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="#8A8A95" strokeOpacity={0.2} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A8A95" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#8A8A95" }} axisLine={false} tickLine={false} unit=" W" />
          <Tooltip contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 12, color: "rgb(var(--ink))" }} formatter={(v) => [`${v} W`]} />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line name="Record absolu" dataKey="record" stroke="#8A8A95" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
          <Line name="Forme des 30 derniers jours" dataKey="recent" stroke="#F24A00" strokeWidth={3} dot={{ r: 3.5 }} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
