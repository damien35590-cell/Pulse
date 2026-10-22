import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Metric, Delta } from "@/components/ui/metric";
import { Sparkline } from "@/components/ui/sparkline";
import { ZoneBar } from "@/components/activity/zone-bar";
import { CyclingVolume } from "@/components/analysis/cycling-volume";
import { CyclingPerformance } from "@/components/analysis/cycling-performance";
import { fmtDuration, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import type { CyclingAnalysis } from "@/lib/analytics/cycling";

/** Blocs de la page Analyse pour le vélo : remplacent les blocs pensés pour la course (allure en running…). Un bloc sans données est masqué. */
export function CyclingView({ data, weeks }: { data: CyclingAnalysis; weeks: number }) {
  if (data.empty) {
    return (
      <div className={cn(ui.card, "p-6 text-center")}>
        <p className="text-metric-sm font-semibold">Aucune sortie vélo sur {weeks} semaines</p>
        <p className="mt-1 text-sm text-ink-soft">Les vélotafs ne comptent pas comme entraînement. Importe une sortie pour voir ta puissance, tes meilleurs efforts et tes zones.</p>
        <Link href="/import" className={cn(ui.btnPrimary, "mt-5 w-full")}>Importer une sortie</Link>
        {data.footer.commutes > 0 && <p className="mt-4 text-xs text-ink-mute">{data.footer.commutes} vélotaf{data.footer.commutes > 1 ? "s" : ""} sur la période, exclu{data.footer.commutes > 1 ? "s" : ""}.</p>}
      </div>
    );
  }
  const { summary, weekly, hasLoad, rides, efficiency, bests, ftp, zones, insights, footer } = data;
  return (
    <div className="space-y-8">
      <Section title="Résumé de la période">
        <dl className={cn(ui.card, "grid grid-cols-2 gap-4 p-4")}>
          <Metric label="Sorties" value={summary.rides} size="lg" />
          <Metric label="Temps total" value={fmtDuration(summary.timeS)} size="lg" />
          <Metric label="Distance" value={fmtNum(summary.km, 0)} unit="km" size="lg" />
          {summary.avgPower != null && <Metric label="Puissance moyenne" value={summary.avgPower} unit="W" size="lg" />}
          {summary.elevationM != null && <Metric label="Dénivelé +" value={fmtNum(summary.elevationM, 0)} unit="m" size="lg" />}
        </dl>
      </Section>

      <Section title="Volume par semaine"><div className={cn(ui.card, "p-4")}><CyclingVolume weekly={weekly} hasLoad={hasLoad} /></div></Section>

      {rides.length > 0 && (
        <Section title="Puissance et vitesse">
          <div className={cn(ui.card, "space-y-5 p-4")}>
            <CyclingPerformance rides={rides} />
            {efficiency && (
              <div>
                <dl><Metric label="Puissance / FC" value={fmtNum(efficiency.values[efficiency.values.length - 1], 2)} unit="W/bpm" size="md"
                  hint={efficiency.changePct != null ? <><Delta good={efficiency.changePct >= 0}>{efficiency.changePct > 0 ? "+" : ""}{fmtNum(efficiency.changePct, 1)} %</Delta> <span className="ml-1">sur la période</span></> : "Dernière sortie"} /></dl>
                <Sparkline values={efficiency.values} className="mt-2 text-brand" />
              </div>
            )}
          </div>
        </Section>
      )}

      {bests && (
        <Section title="Courbe de puissance">
          <div className={cn(ui.card, "space-y-4 p-4")}>
            <dl className="grid grid-cols-2 gap-4">
              {bests.map((b) => (
                <Metric key={b.label} label={`Meilleur ${b.label}`} value={b.watts} unit="W" size="lg"
                  hint={b.prev ? <Delta good={b.watts >= b.prev}>{b.watts - b.prev > 0 ? "+" : ""}{b.watts - b.prev} W</Delta> : "Pas de référence avant"} />
              ))}
            </dl>
            {ftp.estimated && <dl><Metric label="FTP estimée" value={ftp.estimated} unit="W" size="md" tone="brand" hint="95 % du meilleur 20 min" /></dl>}
            <p className="text-xs text-ink-mute">Comparé aux {weeks} semaines précédentes.</p>
          </div>
        </Section>
      )}

      {zones && (
        <Section title="Temps par zone">
          <div className={cn(ui.card, "p-4")}>
            <ZoneBar zones={zones.slices} />
            <p className="mt-4 text-xs text-ink-mute">
              {zones.kind === "power" ? `Zones de puissance, FTP ${zones.ref} W${ftp.manual ? "" : " (estimée)"}` : `Zones de fréquence cardiaque, FC max ${zones.ref} bpm`}, sur {zones.rides} sortie{zones.rides > 1 ? "s" : ""} récente{zones.rides > 1 ? "s" : ""}.
            </p>
          </div>
        </Section>
      )}

      {insights.length > 0 && (
        <Section title="À retenir">
          <ul className={cn(ui.card, "space-y-3 p-4 text-sm")}>{insights.map((t) => <li key={t} className="text-ink-soft">{t}</li>)}</ul>
        </Section>
      )}

      <p className="px-1 text-xs text-ink-mute">
        {fmtNum(footer.km, 0)} km à l’entraînement
        {footer.commutes > 0 && <> · {footer.commutes} vélotaf{footer.commutes > 1 ? "s" : ""} exclu{footer.commutes > 1 ? "s" : ""} ({fmtNum(footer.commuteKm, 0)} km)</>}
      </p>
    </div>
  );
}
