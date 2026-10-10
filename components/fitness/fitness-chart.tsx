"use client";
import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type P = { key: string; ctl: number; atl: number; form: number };
const day = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function Tip({ active, payload }: { active?: boolean; payload?: { payload: P }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-md">
      <p className="font-semibold">{day(p.key)}</p>
      <p>Fitness <b>{Math.round(p.ctl)}</b>, fatigue <b>{Math.round(p.atl)}</b></p>
      <p>Forme <b>{p.form > 0 ? "+" : ""}{Math.round(p.form)}</b></p>
    </div>
  );
}

export function FitnessChart({ data }: { data: P[] }) {
  return (
    <div role="img" aria-label="Fitness, fatigue et forme sur 90 jours">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="fit" margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="key" hide /><YAxis hide domain={[0, "dataMax + 5"]} />
            <Tooltip content={<Tip />} cursor={{ stroke: "#8A8A95" }} />
            <Area dataKey="ctl" stroke="#F24A00" strokeWidth={3} fill="#F24A00" fillOpacity={0.15} dot={false} isAnimationActive={false} />
            <Line dataKey="atl" stroke="#8A8A95" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="fit" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="key" hide /><YAxis hide />
            <ReferenceLine y={0} stroke="#8A8A95" strokeOpacity={0.5} />
            <Tooltip content={() => null} cursor={false} />
            <Bar dataKey="form" isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={d.form >= 0 ? "#F24A00" : "#8A8A95"} fillOpacity={0.8} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-ink-soft">Courbe orange : fitness. Pointillés : fatigue. Barres : forme (fitness moins fatigue).</p>
    </div>
  );
}
