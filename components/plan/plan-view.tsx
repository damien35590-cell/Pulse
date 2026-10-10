"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleSession, deletePlan } from "@/app/actions";
import { tap } from "@/lib/haptics";
import type { Plan } from "@/lib/plan";
import { cn } from "@/lib/utils";

const DAY = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function PlanView({ id, plan, done: init }: { id: string; plan: Plan; done: string[] }) {
  const [week, setWeek] = useState(1), [done, setDone] = useState(new Set(init)), [, start] = useTransition();
  const w = plan.list[week - 1], total = plan.list.reduce((a, x) => a + x.sessions.length, 0), mx = Math.max(...plan.list.map((x) => x.volume));
  const toggle = (k: string) => { tap(10); setDone((d) => { const n = new Set(d); n.has(k) ? n.delete(k) : n.add(k); return n; }); start(() => { toggleSession(id, k); }); };
  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between"><h2 className="font-bold">{plan.goalLabel}, {plan.weeks} semaines</h2><span className="text-sm font-bold text-brand">{done.size}/{total} faites</span></div>
        {plan.base != null && <p className="mt-1.5 text-sm text-ink-soft">Votre volume actuel : <b className="text-ink">{plan.base.toFixed(1).replace(".", ",")} km/sem</b>. Pic prévu : <b className="text-ink">{plan.peak} km/sem</b>.</p>}
        <div className="mt-3 flex h-16 items-end gap-1.5" aria-hidden>{plan.list.map((x) => <div key={x.w} className="flex flex-1 flex-col items-center gap-1 text-[11px] text-ink-soft"><div className={cn("w-full rounded-md bg-brand", x.w === week ? "" : "opacity-35")} style={{ height: Math.max(6, (x.volume / mx) * 46) }} />{x.w}</div>)}</div>
      </section>
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">{plan.list.map((x) => <button key={x.w} onClick={() => setWeek(x.w)} aria-pressed={x.w === week} className={cn("min-h-11 shrink-0 rounded-full px-4 font-medium", x.w === week ? "bg-brand text-brand-ink" : "bg-surface-2")}>Sem. {x.w}</button>)}</div>
      <p className="text-sm text-ink-soft">{w.note}</p>
      {w.sessions.map((s, i) => { const k = `${week}-${i}`, on = done.has(k); return (
        <button key={k} onClick={() => toggle(k)} aria-pressed={on} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-left">
          <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2", on ? "border-brand bg-brand text-brand-ink" : "border-line")}>{on && <Check className="h-4 w-4" strokeWidth={3} />}</span>
          <span className={on ? "opacity-60" : ""}><span className="block text-sm text-ink-soft">{DAY[s.day]}</span><b className={on ? "line-through" : ""}>{s.title}</b>{s.lines && <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{s.lines.map((l) => <span key={l} className="block">{l}</span>)}</span>}</span>
        </button>); })}
      <form action={deletePlan}><button className="min-h-11 text-sm text-ink-soft">Supprimer ce programme</button></form>
    </div>
  );
}
