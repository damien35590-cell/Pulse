"use client";
import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Metric } from "@/components/ui/metric";
import { fmtDayKey } from "@/lib/format";
import { useThemeColors } from "@/lib/use-theme-colors";
import type { Fit } from "@/lib/fitness";

export type FormData = { series: Fit[]; ctl: number; atl: number; form: number; zone: { label: string; tip: string } };

/** Forme : fitness (maintenant, marque) et fatigue (référence, gris pointillé) sur 84 jours, fraîcheur (fitness − fatigue) en barres. Calcul : lib/fitness.ts. */
export function FormChart({ data }: { data: FormData }) {
  const c = useThemeColors(), { series, ctl, atl, form, zone } = data;
  const box = { background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink };
  const fmtKey = (k: unknown) => fmtDayKey(String(k));
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-3 gap-3">
        <Metric label="Fitness" value={Math.round(ctl)} size="md" />
        <Metric label="Fatigue" value={Math.round(atl)} size="md" />
        <Metric label="Fraîcheur" value={`${form > 0 ? "+" : ""}${Math.round(form)}`} size="md" tone="brand" />
      </dl>
      <div role="img" aria-label="Fitness, fatigue et fraîcheur sur 84 jours">
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} syncId="form" margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="key" hide /><YAxis hide domain={[0, "dataMax + 5"]} />
              <Tooltip contentStyle={box} labelFormatter={fmtKey} formatter={(v, n) => [Math.round(Number(v)), n]} cursor={{ stroke: c.inkMute }} />
              <Area name="Fitness" dataKey="ctl" stroke={c.brandText} strokeWidth={2.5} fill={c.brand} fillOpacity={0.15} dot={false} isAnimationActive={false} />
              <Line name="Fatigue" dataKey="atl" stroke={c.inkMute} strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="h-20">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} syncId="form" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="key" hide /><YAxis hide />
              <ReferenceLine y={0} stroke={c.inkMute} strokeOpacity={0.5} />
              <Tooltip content={() => null} cursor={false} />
              <Bar dataKey="form" isAnimationActive={false}>{series.map((d, i) => <Cell key={i} fill={d.form >= 0 ? c.brand : c.inkMute} fillOpacity={0.8} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        <li className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded-full bg-brand-text" aria-hidden />Fitness</li>
        <li className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded-full bg-ink-mute" aria-hidden />Fatigue</li>
        <li className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-brand" aria-hidden />Fraîcheur</li>
      </ul>
      <p className="text-sm text-ink-soft"><b className="text-ink">{zone.label}</b> · {zone.tip}</p>
    </div>
  );
}
