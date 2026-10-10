"use client";
import { useState } from "react";
import { generatePlan } from "@/app/actions";
import { PLAN_GOALS, type PlanSport } from "@/lib/plan";
import { SPORTS, MY_SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";

const sel = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";

export function PlanForm({ hasPlan }: { hasPlan: boolean }) {
  const [sport, setSport] = useState<PlanSport>("RUN");
  return (
    <form action={generatePlan} className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <input type="hidden" name="sport" value={sport} />
      <div role="radiogroup" aria-label="Sport" className="grid grid-cols-4 gap-1.5 rounded-xl bg-surface-2 p-1">
        {MY_SPORTS.map((k) => <button type="button" key={k} role="radio" aria-checked={sport === k} onClick={() => setSport(k)} className={cn("min-h-11 rounded-lg text-sm font-semibold", sport === k ? "bg-surface shadow" : "text-ink-soft")}>{SPORTS[k].label}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
        <label className="col-span-2">Objectif<select name="goalIdx" className={sel} key={sport}>{PLAN_GOALS[sport].map((g, i) => <option key={g[0]} value={i}>{g[0]}</option>)}</select></label>
        <label>Durée<select name="weeks" defaultValue="8" className={sel}>{[4, 8, 12].map((n) => <option key={n} value={n}>{n} semaines</option>)}</select></label>
        <label>Séances par semaine<select name="days" defaultValue="3" className={sel}>{(sport === "WORKOUT" ? [2, 3, 4] : [2, 3, 4, 5]).map((n) => <option key={n}>{n}</option>)}</select></label>
      </div>
      <button className="min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink">{hasPlan ? "Remplacer mon programme" : "Générer mon programme"}</button>
    </form>
  );
}
