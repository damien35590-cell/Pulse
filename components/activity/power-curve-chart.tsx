"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DURATION_LABELS } from "@/lib/power";
import { useThemeColors } from "@/lib/use-theme-colors";

/** Courbe de puissance : « maintenant » (30 derniers jours) en couleur de marque, la référence (record absolu) en gris. Légende en mots. */
export function PowerCurveChart({ record, recent }: { record: (number | null)[]; recent: (number | null)[] }) {
  const c = useThemeColors();
  const data = DURATION_LABELS.map((label, i) => ({ label, record: record[i], recent: recent[i] }));
  const tick = { fontSize: 11, fill: c.inkMute };
  return (
    <div>
      <div className="h-56" role="img" aria-label="Courbe de puissance : record absolu et 30 derniers jours">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={c.inkMute} strokeOpacity={0.2} vertical={false} />
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} />
            <YAxis tick={tick} axisLine={false} tickLine={false} unit=" W" />
            <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink }} formatter={(v, n) => [`${v} W`, n]} />
            <Line name="Record absolu" dataKey="record" stroke={c.inkMute} strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3, fill: c.inkMute, stroke: c.inkMute }} connectNulls isAnimationActive={false} />
            <Line name="30 derniers jours" dataKey="recent" stroke={c.brandText} strokeWidth={3} dot={{ r: 3.5, fill: c.brandText, stroke: c.brandText }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        <li className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded-full bg-brand-text" aria-hidden />30 derniers jours</li>
        <li className="flex items-center gap-1.5"><i className="h-0.5 w-4 rounded-full bg-ink-mute" aria-hidden />Record absolu</li>
      </ul>
    </div>
  );
}
