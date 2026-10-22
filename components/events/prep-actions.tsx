"use client";
import { useState, useTransition } from "react";
import { Target, Check } from "lucide-react";
import { createRaceGoal, setRaceGoalTime } from "@/app/actions";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { field, parseGoal } from "./race-form";

/** « Fixer un objectif de temps » : édition inline, la page se met à jour après l'enregistrement. */
export function GoalTimeInline({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const [err, setErr] = useState(false);
  const [pending, start] = useTransition();
  const s = parseGoal(v), bad = v.trim() !== "" && !s;
  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand"><Target className="h-4 w-4" aria-hidden />Fixer un objectif de temps</button>;
  return (
    <div className="flex items-end gap-2">
      <label className="min-w-0 flex-1 text-sm text-ink-soft">Objectif (h:mm:ss)<input autoFocus value={v} onChange={(e) => { setErr(false); setV(e.target.value); }} inputMode="numeric" placeholder="1:15:00" className={field} aria-invalid={bad || err} /></label>
      <button disabled={!s || pending} onClick={() => start(async () => { tap(6); if (!(await setRaceGoalTime(id, s!)).ok) setErr(true); })}
        className="min-h-12 rounded-xl bg-brand px-4 font-semibold text-brand-ink disabled:opacity-50">{pending ? "…" : "OK"}</button>
      {(bad || err) && <p role="alert" className="sr-only">Format attendu : 1:15:00</p>}
    </div>
  );
}

/** Objectif hebdo lié à la course, en 1 tap : il apparaît sur l'accueil et dans Objectifs. */
export function RaceGoalButton({ id, km, sportLabel, active }: { id: string; km: number; sportLabel: string; active: boolean }) {
  const [msg, setMsg] = useState<string | null>(active ? `Objectif actif : ${km} km/semaine en ${sportLabel}.` : null);
  const [pending, start] = useTransition();
  if (msg) return <p role="status" className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-soft"><Check className="h-4 w-4 text-brand" aria-hidden />{msg}</p>;
  return (
    <button disabled={pending} onClick={() => start(async () => { tap(6); const r = await createRaceGoal(id); setMsg(r.ok ? `${r.updated ? "Objectif mis à jour" : "Objectif ajouté"} : ${r.km} km/semaine, visible sur l’accueil.` : r.error); })}
      className={cn("flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-brand/40 bg-brand-soft font-semibold text-brand", pending && "opacity-60")}>
      <Target className="h-4 w-4" aria-hidden />{pending ? "Ajout…" : `Objectif hebdo : ${km} km en ${sportLabel}`}
    </button>
  );
}
