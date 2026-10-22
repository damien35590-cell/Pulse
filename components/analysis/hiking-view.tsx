import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Metric } from "@/components/ui/metric";
import { HikingVolume } from "@/components/analysis/hiking-volume";
import { HikingPace } from "@/components/analysis/hiking-pace";
import { fmtDayKey, fmtDuration, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import type { HikeRecord, HikingAnalysis } from "@/lib/analytics/hiking";

const rec = (r: HikeRecord | null, label: string, unit: string, digits: number) =>
  r && <Metric key={label} label={label} value={fmtNum(r.value, digits)} unit={unit} size="md" hint={<Link href={`/activities/${r.id}`} className="text-brand">{fmtDayKey(r.day)} · {r.title}</Link>} />;

/** Blocs de la page Analyse pour la randonnée : remplacent ceux pensés pour la course (allure en running…). */
export function HikingView({ data, weeks }: { data: HikingAnalysis; weeks: number }) {
  if (data.empty) {
    return (
      <div className={cn(ui.card, "p-6 text-center")}>
        <p className="text-metric-sm font-semibold">Aucune randonnée sur {weeks} semaines</p>
        {data.last
          ? <p className="mt-2 text-sm text-ink-soft">Dernière rando : <Link href={`/activities/${data.last.id}`} className="font-semibold text-brand">{data.last.title}</Link>, le {fmtDayKey(data.last.day)}.</p>
          : <p className="mt-2 text-sm text-ink-soft">Importe ou enregistre une randonnée pour suivre ton dénivelé et ton rythme en montée.</p>}
        <Link href="/import" className={cn(data.last ? ui.btnSecondary : ui.btnPrimary, "mt-5 w-full")}>Importer une sortie</Link>
      </div>
    );
  }
  const { summary, monthly, hikes, climbRate, records, insights } = data;
  const recs = [rec(records.longest, "Plus longue rando", "km", 1), rec(records.biggestClimb, "Plus gros D+", "m", 0), rec(records.maxAltitude, "Altitude max", "m", 0)].filter(Boolean);
  return (
    <div className="space-y-8">
      <Section title="Résumé de la période">
        <dl className={cn(ui.card, "grid grid-cols-2 gap-4 p-4")}>
          <Metric label="Sorties" value={summary.hikes} size="lg" />
          <Metric label="Distance" value={fmtNum(summary.km, 1)} unit="km" size="lg" />
          <Metric label="Dénivelé +" value={fmtNum(summary.dPlus, 0)} unit="m" size="lg" />
          <Metric label="Temps total" value={fmtDuration(summary.timeS)} size="lg" />
        </dl>
      </Section>

      <Section title="Volume par mois"><div className={cn(ui.card, "p-4")}><HikingVolume monthly={monthly} /></div></Section>

      {(climbRate != null || hikes.some((h) => h.speedKmh != null)) && (
        <Section title="Rythme en montée">
          <div className={cn(ui.card, "space-y-4 p-4")}>
            {climbRate != null && <dl><Metric label="Vitesse ascensionnelle" value={fmtNum(climbRate, 0)} unit="m/h" size="lg" hint="D+ par heure de déplacement" /></dl>}
            <HikingPace hikes={hikes} />
          </div>
        </Section>
      )}

      {recs.length > 0 && <Section title="Records"><dl className={cn(ui.card, "space-y-4 p-4")}>{recs}</dl></Section>}

      {insights.length > 0 && (
        <Section title="À retenir"><ul className={cn(ui.card, "space-y-3 p-4 text-sm")}>{insights.map((t) => <li key={t} className="text-ink-soft">{t}</li>)}</ul></Section>
      )}
    </div>
  );
}
