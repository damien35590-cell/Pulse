"use client";
import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useThemeColors } from "@/lib/use-theme-colors";

type P = { key: string; ctl: number; atl: number; form: number };
const day = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

function Tip({ active, payload }: { active?: boolean; payload?: { payload: P }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-sm shadow-pop">
      <p className="font-semibold">{day(p.key)}</p>
      <p>Fitness <b>{Math.round(p.ctl)}</b>, fatigue <b>{Math.round(p.atl)}</b></p>
      <p>Forme <b>{p.form > 0 ? "+" : ""}{Math.round(p.form)}</b></p>
    </div>
  );
}

/**
 * Fitness, fatigue et forme sur 90 jours. Couleurs = tokens du thème (useThemeColors) : fitness en marque (trait `brand-text`, lisible en clair,
 * remplissage `brand`), fatigue en `ink-mute` pointillé, forme en barres `ink` (pleines au-dessus de 0, atténuées en dessous).
 * La légende reprend les mêmes tokens en classes.
 */
export function FitnessChart({ data }: { data: P[] }) {
  const t = useThemeColors();
  return (
    <div role="img" aria-label="Fitness, fatigue et forme sur 90 jours">
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId="fit" margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="key" hide /><YAxis hide domain={[0, "dataMax + 5"]} />
            <Tooltip content={<Tip />} cursor={{ stroke: t.inkMute }} />
            <Area dataKey="ctl" stroke={t.brandText} strokeWidth={3} fill={t.brand} fillOpacity={0.15} dot={false} isAnimationActive={false} />
            <Line dataKey="atl" stroke={t.inkMute} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId="fit" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="key" hide /><YAxis hide />
            <ReferenceLine y={0} stroke={t.inkMute} strokeOpacity={0.5} />
            <Tooltip content={() => null} cursor={false} />
            <Bar dataKey="form" isAnimationActive={false}>{data.map((d, i) => <Cell key={i} fill={t.ink} fillOpacity={d.form >= 0 ? 0.8 : 0.35} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Légende : une ligne par courbe, pastille aux couleurs du tracé */}
      <ul className="mt-3 space-y-1.5 text-xs leading-snug text-ink-soft">
        <li className="flex gap-2"><span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-brand-text" /><span><b className="font-semibold text-ink">Fitness</b> — ton niveau d’entraînement des 6 dernières semaines.</span></li>
        <li className="flex gap-2"><span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-ink-mute" /><span><b className="font-semibold text-ink">Fatigue</b> (pointillés) — la charge des 7 derniers jours.</span></li>
        <li className="flex gap-2"><span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-ink" /><span><b className="font-semibold text-ink">Forme</b> (barres) — fitness moins fatigue : positif = frais, très négatif = à surveiller.</span></li>
      </ul>
    </div>
  );
}
