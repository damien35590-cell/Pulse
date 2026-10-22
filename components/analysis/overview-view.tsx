import Link from "next/link";
import { Section } from "@/components/ui/section";
import { Metric } from "@/components/ui/metric";
import { VolumeBars } from "@/components/analysis/volume-bars";
import { FitnessChart } from "@/components/fitness/fitness-chart";
import { fmtDuration, fmtNum } from "@/lib/format";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { GROUPS, type OverviewAnalysis, type SportGroup } from "@/lib/analytics/overview";

/** Une teinte par sport, en tokens (--stack-* dans globals.css). Noms de classes complets : Tailwind ne génère que ce qu'il lit en entier. */
const STACK: Record<SportGroup, string> = { WORKOUT: "bg-stack-workout", RUN: "bg-stack-run", RIDE: "bg-stack-ride", HIKE: "bg-stack-hike", OTHER: "bg-stack-other" };
const label = (g: SportGroup) => (g === "OTHER" ? "Autre" : SPORTS[g].label);

/** Page Analyse, onglet « Tous » : séances d'entraînement de tous les sports, sans distance cumulée ni allure. */
export function OverviewView({ data, weeks }: { data: OverviewAnalysis; weeks: number }) {
  if (data.empty) {
    return (
      <div className={cn(ui.card, "p-6 text-center")}>
        <p className="text-metric-sm font-semibold">Aucune séance sur {weeks} semaines</p>
        <p className="mt-1 text-sm text-ink-soft">Les activités douces (vélotaf, marche) ne comptent pas comme entraînement.</p>
        <Link href="/record" className={cn(ui.btnPrimary, "mt-5 w-full")}>Enregistrer une séance</Link>
      </div>
    );
  }
  const { summary, weekly, form, split, regularity, insights, footer } = data;
  const used = GROUPS.filter((g) => split.some((s) => s.group === g));
  return (
    <div className="space-y-8">
      <Section title="Résumé de la période">
        <dl className={cn(ui.card, "grid grid-cols-2 gap-4 p-4")}>
          <Metric label="Séances" value={summary.sessions} size="lg" />
          <Metric label="Temps total" value={fmtDuration(summary.timeS)} size="lg" />
          {summary.load != null && <Metric label="Charge" value={fmtNum(summary.load, 0)} unit="pts" size="lg" />}
          <Metric label="Jours actifs" value={summary.activeDays} unit={`/ ${weeks * 7}`} size="lg" />
        </dl>
      </Section>

      <Section title="Volume par semaine">
        <div className={cn(ui.card, "space-y-4 p-4")}>
          <VolumeBars
            unit="h" digits={1}
            weeks={weekly.map((w) => ({ weekStart: w.weekStart, value: GROUPS.reduce((s, g) => s + w.hours[g], 0), parts: GROUPS.map((g) => ({ cls: STACK[g], value: w.hours[g] })) }))}
          />
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
            {used.map((g) => <li key={g} className="flex items-center gap-1.5"><i className={cn("size-2.5 rounded-full", STACK[g])} />{label(g)}</li>)}
          </ul>
        </div>
      </Section>

      {form && (
        <Section title="Forme">
          <div className={cn(ui.card, "space-y-4 p-4")}>
            <dl className="grid grid-cols-3 gap-3">
              <Metric label="Fitness" value={Math.round(form.ctl)} size="md" />
              <Metric label="Fatigue" value={Math.round(form.atl)} size="md" />
              <Metric label="Fraîcheur" value={`${form.form > 0 ? "+" : ""}${Math.round(form.form)}`} size="md" tone="brand" />
            </dl>
            <FitnessChart data={form.series} />
            <p className="text-sm text-ink-soft"><b className="text-ink">{form.zone.label}</b> · {form.zone.tip}</p>
          </div>
        </Section>
      )}

      <Section title="Répartition">
        <ul className={cn(ui.card, "space-y-4 p-4")}>
          {split.map((s) => (
            <li key={s.group}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 font-semibold"><i className={cn("size-2.5 rounded-full", STACK[s.group])} />{label(s.group)}</span>
                <span className="text-sm text-ink-soft"><b className="font-num tabular-nums text-ink">{s.timePct} %</b> du temps · <b className="font-num tabular-nums text-ink">{s.sessionsPct} %</b> des séances</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden><div className={cn("h-full rounded-full", STACK[s.group])} style={{ width: `${Math.max(2, s.timePct)}%` }} /></div>
              <p className="mt-1 text-xs text-ink-mute">{fmtDuration(s.timeS)} · {s.sessions} séance{s.sessions > 1 ? "s" : ""}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Régularité">
        <dl className={cn(ui.card, "grid grid-cols-2 gap-4 p-4")}>
          <Metric label="Séances par semaine" value={fmtNum(regularity.perWeek, 1)} size="lg" />
          <Metric label="Semaines actives" value={regularity.activeStreak} unit="d'affilée" size="lg" tone={regularity.activeStreak >= 4 ? "good" : "default"} />
        </dl>
      </Section>

      {insights.length > 0 && (
        <Section title="À retenir"><ul className={cn(ui.card, "space-y-3 p-4 text-sm")}>{insights.map((t) => <li key={t} className="text-ink-soft">{t}</li>)}</ul></Section>
      )}

      {footer.softCount > 0 && <p className="px-1 text-xs text-ink-mute">{fmtDuration(footer.softTimeS)} d’activités douces (vélotaf, marche), non comptées ci-dessus.</p>}
    </div>
  );
}
