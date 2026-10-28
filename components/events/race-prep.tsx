import { Lightbulb } from "lucide-react";
import type { PrepState, RacePrep } from "@/lib/races/prep";
import { fmtRaceDistance } from "@/lib/races/format";
import { cn } from "@/lib/utils";
import { PrepChart } from "./prep-chart";
import { GoalTimeInline, RaceGoalButton } from "./prep-actions";

const fr = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
export const STATE_STYLE: Record<PrepState, string> = {
  "En avance": "bg-good/15 text-good",
  "Dans le rythme": "bg-brand/10 text-brand",
  "À relancer": "bg-warn/15 text-warn",
};

function Gauge({ title, value, sub, pct }: { title: string; value: string; sub: string; pct: number | null }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface p-3">
      <p className="truncate text-xs font-semibold text-ink-soft">{title}</p>
      <p className="mt-0.5 font-display text-2xl font-bold leading-tight tabular-nums">{value}</p>
      {pct != null && <div className="my-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className={cn("h-full rounded-full", pct >= 100 ? "bg-good" : "bg-brand")} style={{ width: `${Math.min(100, pct)}%` }} /></div>}
      <p className="text-xs leading-snug text-ink-soft">{sub}</p>
    </div>
  );
}

type Props = { id: string; prep: RacePrep; distanceKm: number | null; hasGoalTime: boolean; goal: { km: number; sportLabel: string; active: boolean } | null };

/** Section « Préparation » de la page d'une course à venir. */
export function RacePrepSection({ id, prep: p, distanceKm, hasGoalTime, goal }: Props) {
  const points = p.weeks.map((w) => ({
    start: w.start, phase: w.phase, current: w.current, future: w.future,
    km: w.future ? null : w.km, plan: w.future && w.target ? (w.target.lo + w.target.hi) / 2 : null, band: w.target ? [w.target.lo, w.target.hi] as [number, number] : null,
  }));
  const wk = p.weeksLeft;
  return (
    <section aria-labelledby="prep-title" className="space-y-3">
      <div className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="prep-title" className="text-xs font-bold uppercase tracking-wider text-ink-soft">Préparation</h2>
            <p className="font-display text-2xl font-bold leading-tight">{p.phase}</p>
            <p className="text-sm text-ink-soft">{p.phase === "Jour J" ? "C’est aujourd’hui" : wk >= 1 ? `${wk} semaine${wk > 1 ? "s" : ""} avant la course` : `${p.daysLeft} jour${p.daysLeft > 1 ? "s" : ""} avant la course`}</p>
          </div>
          <span className={cn("shrink-0 rounded-full px-3 py-1 text-sm font-bold", STATE_STYLE[p.state])}>{p.state}</span>
        </div>
        <p className="mt-3 text-sm">Cette semaine : <b>{fr(p.thisWeek.km)} km</b> · {p.thisWeek.count} sortie{p.thisWeek.count > 1 ? "s" : ""}{p.thisWeek.dPlus ? ` · ${p.thisWeek.dPlus} m D+` : ""}{p.target ? <span className="text-ink-soft"> (cible {fr(p.target.lo, 0)}–{fr(p.target.hi, 0)} km)</span> : null}</p>
        <div className="mt-3"><PrepChart data={points} /></div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {distanceKm
          ? <Gauge title="Sortie longue" value={`${fr(p.longest.km)} km`} pct={p.longest.ratio != null ? p.longest.ratio * 100 : null} sub={`${Math.round((p.longest.ratio ?? 0) * 100)} % des ${fmtRaceDistance(distanceKm)} (28 j)`} />
          : <Gauge title="Sortie longue" value={`${fr(p.longest.km)} km`} pct={null} sub="sur 28 jours" />}
        <Gauge title="Régularité" value={`${p.regularity.weeks}/${p.regularity.of}`} pct={(p.regularity.weeks / p.regularity.of) * 100} sub="semaines à 2 sorties ou plus" />
        {p.elevation
          ? <Gauge title="D+" value={`${fr(p.elevation.bestWeek, 0)} m`} pct={p.elevation.ratio * 100} sub={`meilleure semaine / ${p.elevation.target} m le jour J`} />
          : <Gauge title="Volume" value={`${fr(p.avgKm)} km`} pct={p.target ? (p.avgKm / p.target.lo) * 100 : null} sub="moyenne des 3 dernières semaines" />}
      </div>

      <ul className="space-y-2 rounded-xl border border-line bg-surface p-4" aria-label="Conseils">
        {p.tips.map((t) => <li key={t} className="flex gap-2.5 text-sm"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />{t}</li>)}
      </ul>

      {p.pace ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
          <div><p className="text-xs font-semibold text-ink-soft">Allure cible</p><p className="font-display text-2xl font-bold tabular-nums">{p.pace.goal}</p></div>
          <div className="text-right">
            <p className="text-xs font-semibold text-ink-soft">Allure récente</p>
            <p className={cn("font-display text-2xl font-bold tabular-nums", p.pace.recentS && p.pace.recentS <= p.pace.goalS && "text-good")}>{p.pace.recent ?? "—"}</p>
            <p className="text-[11px] text-ink-soft">{p.pace.n ? `${p.pace.n} sortie${p.pace.n > 1 ? "s" : ""} de distance proche` : "pas de sortie de distance proche"}</p>
          </div>
        </div>
      ) : !hasGoalTime && distanceKm ? <GoalTimeInline id={id} /> : null}

      {goal && <RaceGoalButton id={id} km={goal.km} sportLabel={goal.sportLabel} active={goal.active} />}
    </section>
  );
}
