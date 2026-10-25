"use client";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { PowerCurveChart } from "@/components/activity/power-curve-chart";
import { FormChart, type FormData } from "@/components/analysis/form-chart";
import { ZonesChart, type ZonesData } from "@/components/analysis/zones-chart";
import { ProgressionChart, type Ladder } from "@/components/analysis/progression-chart";
import { fmtNum, fmtPaceS } from "@/lib/format";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Mode = "progression" | "volume" | "form" | "pace" | "power" | "zones";
export type WeekPoint = { label: string; value: number };

type Props = {
  /** Volume par semaine : km (sports d'endurance), heures (Tous) ou séances (musculation). */
  weekly: WeekPoint[]; unit: "km" | "h" | "séances";
  /** Nom du volume dans la bascule : « Distance », « Durée », « Séances ». */
  volumeLabel: string;
  /** Allure moyenne par semaine en min/km (course seulement). */
  pace?: WeekPoint[];
  /** Courbe de puissance (vélo seulement). */
  power?: { record: (number | null)[]; recent: (number | null)[] } | null;
  /** Forme : fitness, fatigue, fraîcheur (Tous). */
  form?: FormData | null;
  /** Temps par zone et par semaine (vélo). */
  zones?: ZonesData | null;
  /** Progression par exercice (musculation) ; première option, donc ouverte par défaut. */
  progression?: Ladder[] | null;
};

const fmtPace = (p: number) => fmtPaceS(p * 60);

/**
 * Bloc « Évolution » : un seul graphique, dont les options dépendent du filtre. Tous : Durée | Forme. Running : Distance | Allure.
 * Vélo : Distance | Puissance | Zones. Musculation : Progression | Séances. Rando : Distance. « Maintenant » en marque, référence en gris.
 * L'option affichée en premier est ouverte par défaut (changer de filtre remonte un nouveau composant : `key` côté page).
 */
export function EvolutionCard({ weekly, unit, volumeLabel, pace, power, form, zones, progression }: Props) {
  const options = ([
    progression?.length ? { value: "progression", label: "Progression" } : null,
    { value: "volume", label: volumeLabel },
    form ? { value: "form", label: "Forme" } : null,
    pace && pace.length > 2 ? { value: "pace", label: "Allure" } : null,
    power?.record.some(Boolean) ? { value: "power", label: "Puissance" } : null,
    zones ? { value: "zones", label: "Zones" } : null,
  ].filter(Boolean)) as { value: Mode; label: string }[];
  const [mode, setMode] = useState<Mode>(options[0].value);
  const cur = options.some((o) => o.value === mode) ? mode : options[0].value;
  return (
    <Section title="Évolution">
      <div className={cn(ui.card, "space-y-4 p-4")}>
        {options.length > 1 && <Segmented options={options} value={cur} onChange={setMode} />}
        {cur === "progression" && <ProgressionChart ladders={progression!} />}
        {cur === "volume" && <WeeklyBars data={weekly} unit={unit} name={volumeLabel} />}
        {cur === "form" && <FormChart data={form!} />}
        {cur === "pace" && <PaceArea data={pace!} />}
        {cur === "power" && <PowerCurveChart record={power!.record} recent={power!.recent} />}
        {cur === "zones" && <ZonesChart data={zones!} />}
      </div>
    </Section>
  );
}

function WeeklyBars({ data, unit, name }: { data: WeekPoint[]; unit: "km" | "h" | "séances"; name: string }) {
  const c = useThemeColors(), total = data.reduce((s, d) => s + d.value, 0), avg = data.length ? total / data.length : 0;
  const tick = { fontSize: 11, fill: c.inkMute };
  return (
    <div className="space-y-4">
      <div className="h-44" role="img" aria-label={`${name} par semaine`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} /><YAxis hide />
            <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink }} cursor={{ fill: c.inkMute, fillOpacity: 0.15 }} formatter={(v) => [`${fmtNum(Number(v), 1)} ${unit}`, name]} labelFormatter={(l) => `Semaine du ${l}`} />
            <Bar dataKey="value" fill={c.brand} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <Metric label="Total" value={fmtNum(total, 1)} unit={unit} size="md" />
        <Metric label="Par semaine" value={fmtNum(avg, 1)} unit={unit} size="md" />
      </dl>
    </div>
  );
}

function PaceArea({ data }: { data: WeekPoint[] }) {
  const c = useThemeColors();
  const best = data.reduce((m, d) => (d.value < m.value ? d : m)), worst = data.reduce((m, d) => (d.value > m.value ? d : m));
  const tick = { fontSize: 11, fill: c.inkMute };
  const tag = (p: WeekPoint) => ({ value: fmtPace(p.value), position: p === best ? "top" : "bottom", fill: c.inkSoft, fontSize: 11 } as const);
  return (
    <div className="space-y-4">
      <div className="h-44" role="img" aria-label="Allure moyenne par semaine">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 12, left: 12, bottom: 12 }}>
            <defs><linearGradient id="pace-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.brand} stopOpacity={0.3} /><stop offset="1" stopColor={c.brand} stopOpacity={0} /></linearGradient></defs>
            <XAxis dataKey="label" tick={tick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
            <YAxis hide reversed domain={["dataMin - 0.2", "dataMax + 0.2"]} />
            <Tooltip contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 12, color: c.ink }} formatter={(v) => [`${fmtPace(Number(v))} /km`, "Allure"]} labelFormatter={(l) => `Semaine du ${l}`} />
            {/* linear : une allure par semaine, sans lissage qui inventerait des creux entre deux points */}
            <Area dataKey="value" type="linear" stroke={c.brandText} strokeWidth={2.5} fill="url(#pace-fill)" dot={{ r: 3, fill: c.brandText, stroke: c.brandText }} isAnimationActive={false} />
            <ReferenceDot x={best.label} y={best.value} r={5} fill={c.brandText} stroke={c.surface} strokeWidth={2} label={tag(best)} ifOverflow="extendDomain" />
            {worst !== best && <ReferenceDot x={worst.label} y={worst.value} r={5} fill={c.inkMute} stroke={c.surface} strokeWidth={2} label={tag(worst)} ifOverflow="extendDomain" />}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <Metric label="Plus rapide" value={fmtPace(best.value)} unit="/km" size="md" tone="brand" hint={`Semaine du ${best.label}`} />
        <Metric label="Plus lente" value={fmtPace(worst.value)} unit="/km" size="md" hint={`Semaine du ${worst.label}`} />
      </dl>
      <p className="text-xs text-ink-mute">Plus la courbe monte, plus tu vas vite.</p>
    </div>
  );
}
