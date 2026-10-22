import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Metric } from "@/components/ui/metric";
import { Sparkline } from "@/components/ui/sparkline";
import { StrengthVolume } from "@/components/analysis/strength-volume";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import type { StrengthAnalysis, StrengthStatus } from "@/lib/analytics/strength";

const STATUS: Record<StrengthStatus, { label: string; cls: string }> = {
  progress: { label: "Progrès", cls: "bg-good/15 text-good" },
  stall1: { label: "Blocage 1", cls: "bg-warn/15 text-warn" },
  stall2: { label: "Blocage 2", cls: "bg-bad/15 text-bad" },
};
const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Blocs de la page Analyse pour la musculation : remplacent tous les blocs d'endurance. */
export function StrengthView({ data, weeks }: { data: StrengthAnalysis; weeks: number }) {
  if (data.empty) {
    return (
      <div className={cn(ui.card, "p-6 text-center")}>
        <p className="text-metric-sm font-semibold">Aucune séance de musculation sur {weeks} semaines</p>
        <p className="mt-1 text-sm text-ink-soft">Enregistre une séance pour voir ton volume, ta progression et ta régularité.</p>
        <Link href="/record/session" className={cn(ui.btnPrimary, "mt-5 w-full")}>Enregistrer une séance</Link>
      </div>
    );
  }
  const { summary, weekly, exercises, regularity, insights } = data;
  const inTarget = regularity.perWeek >= regularity.target[0] && regularity.perWeek <= regularity.target[1];
  return (
    <div className="space-y-8">
      <Section title="Résumé de la période">
        <dl className={cn(ui.card, "grid gap-4 p-4", summary.tonnage != null ? "grid-cols-2" : "grid-cols-3")}>
          <Metric label="Séances" value={summary.sessions} size="lg" />
          <Metric label="Séries" value={fmtNum(summary.sets, 0)} size="lg" />
          <Metric label="Répétitions" value={fmtNum(summary.reps, 0)} size="lg" />
          {summary.tonnage != null && <Metric label="Tonnage" value={fmtNum(summary.tonnage, 0)} unit="kg" size="lg" />}
        </dl>
      </Section>

      <Section title="Volume par semaine"><div className={cn(ui.card, "p-4")}><StrengthVolume weekly={weekly} /></div></Section>

      <Section title="Progression par exercice">
        <div className="space-y-3">
          {exercises.map((e) => (
            <article key={e.key} className={cn(ui.card, "p-4")}>
              <header className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 truncate font-semibold">{e.name}</h3>
                <span className={cn("inline-flex h-7 shrink-0 items-center rounded-full px-2.5 text-xs font-semibold", STATUS[e.status].cls)}>{STATUS[e.status].label}</span>
              </header>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                <Metric label="Niveau" value={e.level} size="md" />
                <Metric label="Variante" value={e.variant ?? "–"} size="md" tone={e.variant ? "default" : "soft"} />
                <Metric label="Dernière" value={lab(e.lastDay)} size="md" />
              </dl>
              {e.repsPerSession.length > 1
                ? <div className="mt-3"><Sparkline values={e.repsPerSession} className="text-brand" /><p className="mt-1 text-xs text-ink-mute">Total de reps par séance ({e.repsPerSession[0]} → {e.repsPerSession[e.repsPerSession.length - 1]})</p></div>
                : <p className="mt-3 text-xs text-ink-mute">1 séance sur la période : {e.repsPerSession[0] ?? 0} reps au total.</p>}
              {e.status === "stall2" && <p className="mt-2 text-sm text-ink-soft">{e.easierVariant ? `Essaie ${e.easierVariant}` : "Même variante"}{e.hint ? ` · objectif ${e.hint}` : ""}</p>}
            </article>
          ))}
        </div>
      </Section>

      <Section title="Régularité">
        <div className={cn(ui.card, "space-y-4 p-4")}>
          <dl><Metric label="Séances par semaine" value={fmtNum(regularity.perWeek, 1)} size="lg" tone={inTarget ? "good" : "default"} hint={`Objectif ${regularity.target[0]} à ${regularity.target[1]} par semaine`} /></dl>
          <div className="grid grid-flow-col auto-cols-fr items-end gap-1" role="img" aria-label="Séances par semaine">
            {weekly.map((w) => (
              <div key={w.weekStart} title={`Semaine du ${lab(w.weekStart)} : ${w.sessions} séance${w.sessions > 1 ? "s" : ""}`} className="flex h-12 flex-col justify-end">
                <div className={cn("w-full rounded-t-md", w.sessions >= regularity.target[0] && w.sessions <= regularity.target[1] ? "bg-good" : w.sessions ? "bg-surface-3" : "bg-surface-2")} style={{ height: `${Math.max(8, Math.min(100, (w.sessions / 4) * 100))}%` }} />
              </div>
            ))}
          </div>
          {regularity.upperPct != null && regularity.lowerPct != null && (
            <div>
              <p className={ui.label}>Répartition des séries</p>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Haut du corps ${regularity.upperPct} %, bas du corps et abdos ${regularity.lowerPct} %`}>
                <div className="bg-brand" style={{ width: `${regularity.upperPct}%` }} />
                <div className="bg-surface-3" style={{ width: `${regularity.lowerPct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-sm text-ink-soft">
                <span><i className="mr-1.5 inline-block size-2 rounded-full bg-brand align-middle" />Haut du corps <b className="font-num tabular-nums text-ink">{regularity.upperPct} %</b></span>
                <span><i className="mr-1.5 inline-block size-2 rounded-full bg-surface-3 align-middle" />Bas + abdos <b className="font-num tabular-nums text-ink">{regularity.lowerPct} %</b></span>
              </div>
            </div>
          )}
        </div>
      </Section>

      {insights.length > 0 && (
        <Section title="À retenir">
          <ul className={cn(ui.card, "space-y-3 p-4 text-sm")}>{insights.map((t) => <li key={t} className="text-ink-soft">{t}</li>)}</ul>
        </Section>
      )}
    </div>
  );
}
