"use client";
import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type P = { key: string; ctl: number; atl: number; form: number };
/** Couleurs des courbes : une seule source pour le graphique et sa légende. */
const FIT = "#F24A00", MUTE = "#8A8A95";
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
            <Tooltip content={<Tip />} cursor={{ stroke: MUTE }} />
            <Area dataKey="ctl" stroke={FIT} strokeWidth={3} fill={FIT} fillOpacity={0.15} dot={false} isAnimationActive={false} />
            <Line dataKey="atl" stroke={MUTE} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="fit" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="key" hide /><YAxis hide />
            <ReferenceLine y={0} stroke={MUTE} strokeOpacity={0.5} />
            <Tooltip content={() => null} cursor={false} />
            <Bar dataKey="form" isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={d.form >= 0 ? FIT : MUTE} fillOpacity={0.8} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Légende : une ligne par courbe, pastille aux couleurs du tracé */}
      <ul className="mt-3 space-y-1.5 text-xs leading-snug text-ink-soft">
        <li className="flex gap-2"><span aria-hidden className="mt-1 size-2 shrink-0 rounded-full" style={{ background: FIT }} /><span><b className="font-semibold text-ink">Fitness</b> — ton niveau d’entraînement des 6 dernières semaines.</span></li>
        <li className="flex gap-2"><span aria-hidden className="mt-1 size-2 shrink-0 rounded-full" style={{ background: MUTE }} /><span><b className="font-semibold text-ink">Fatigue</b> (pointillés) — la charge des 7 derniers jours.</span></li>
        <li className="flex gap-2">
          <span aria-hidden className="mt-1 flex size-2 shrink-0 overflow-hidden rounded-full"><span className="h-full w-1/2" style={{ background: FIT }} /><span className="h-full w-1/2" style={{ background: MUTE }} /></span>
          <span><b className="font-semibold text-ink">Forme</b> (barres) — fitness moins fatigue : positif = frais, très négatif = à surveiller.</span>
        </li>
      </ul>
    </div>
  );
}
