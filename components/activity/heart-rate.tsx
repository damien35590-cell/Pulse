"use client";
import { fmtClock } from "@/lib/format";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Section } from "@/components/ui/section";
import { Metric } from "@/components/ui/metric";
import { TraceChart, type Band } from "@/components/activity/trace-chart";
import { ZONE_BG, ZoneBar, type ZoneSlice } from "@/components/activity/zone-bar";

const QUARTERS = [0, 0.25, 0.5, 0.75, 1];

type Props = {
  /** FC à pas régulier (une valeur toutes les `stepS` secondes, sans les trous de capteur). */
  values: number[];
  durationS: number;
  /** Bornes hautes de Z1 à Z5 (bpm), si la FC max est connue. */
  upper?: number[] | null;
  zones?: ZoneSlice[] | null;
  /** « FC max 190 bpm (estimée) » */
  note?: string;
  /** Chiffres en tête de carte (muscu : FC moy., FC max, baisse au repos). */
  metrics?: { label: string; value: string | number; unit?: string }[];
  /** Temps par zone en une barre seule (muscu), au lieu du détail zone par zone. */
  compact?: boolean;
};

/** Fréquence cardiaque : courbe au doigt sur fond de zones, puis temps par zone. La page ne l'affiche que s'il y a des mesures. */
export function HeartRate({ values, durationS, upper, zones, note, metrics, compact }: Props) {
  const bands: Band[] | undefined = upper?.length
    ? [0, ...upper].map((from, i) => ({ from, to: upper[i] ?? 250, className: ZONE_BG[(i + 1) as keyof typeof ZONE_BG], label: `Z${i + 1}` }))
    : undefined;
  return (
    <Section title="Fréquence cardiaque" action={note && <span className="text-xs text-ink-mute">{note}</span>}>
      <div className={cn(ui.card, "space-y-6 p-4")}>
        {metrics && metrics.length > 0 && (
          <dl className="grid grid-cols-3 gap-3">
            {metrics.map((m) => <Metric key={m.label} size="lg" label={m.label} value={m.value} unit={m.unit} />)}
          </dl>
        )}
        <TraceChart
          values={values}
          unit="bpm"
          label="Fréquence cardiaque"
          color="text-z5"
          bands={bands}
          area={!bands}
          ticks={QUARTERS.map((q) => `${Math.round((q * durationS) / 60)}'`)}
          at={(f) => fmtClock(f * durationS)}
        />
        {zones && zones.some((z) => z.seconds > 0) && <ZoneBar zones={zones} compact={compact} />}
      </div>
    </Section>
  );
}
