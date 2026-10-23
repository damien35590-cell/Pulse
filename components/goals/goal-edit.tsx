"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { deleteGoal, updateGoal } from "@/app/actions";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Segmented } from "@/components/ui/segmented";
import { METRICS, PERIODS, type Metric, type Period } from "@/lib/goals";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Pas du « ± » selon la mesure : on change un objectif de quelques km, d'une heure, de 100 m… */
const STEP: Record<Metric, number> = { DISTANCE: 5, TIME: 1, ELEVATION: 100, ACTIVITIES: 1 };
const PERIOD_SHORT: Record<Period, string> = { WEEK: "Semaine", MONTH: "Mois", YEAR: "Année" };
const sel = "mt-1 min-h-12 w-full rounded-tile bg-surface-2 px-3 text-base text-ink";

type Goal = { id: string; metric: Metric; period: Period; type: string | null; target: number };

/** Bouton « Modifier » d'une carte d'objectif : feuille pré-remplie, enregistrement en place. */
export function GoalEdit({ g, sports }: { g: Goal; sports: { key: string; label: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [metric, setMetric] = useState<Metric>(g.metric);
  const [period, setPeriod] = useState<Period>(g.period);
  const [type, setType] = useState(g.type ?? "");
  const [target, setTarget] = useState(g.target / METRICS[g.metric].base);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const openSheet = () => {
    tap();
    setMetric(g.metric); setPeriod(g.period); setType(g.type ?? ""); setTarget(g.target / METRICS[g.metric].base); setErr(null);
    setOpen(true);
  };
  const save = () => {
    const fd = new FormData();
    fd.set("metric", metric); fd.set("period", period); fd.set("type", type); fd.set("target", String(target));
    start(async () => {
      const r = await updateGoal(g.id, fd);
      if (!r.ok) return setErr(r.error);
      setOpen(false);
      router.refresh();
    });
  };
  const remove = () => start(async () => { await deleteGoal(g.id); setOpen(false); router.refresh(); });

  return (
    <>
      <button type="button" onClick={openSheet} aria-label="Modifier l’objectif" className={cn(ui.iconBtn, "-mr-2 -mt-2 text-ink-soft")}>
        <Pencil className="size-5" aria-hidden />
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Modifier l’objectif">
        <div className="mt-4 space-y-5">
          <NumberStepper
            label="Cible"
            value={target}
            onChange={(v) => { setTarget(v); setErr(null); }}
            step={STEP[metric]}
            min={0}
            max={100000}
            unit={METRICS[metric].unit}
          />

          <div>
            <p className={ui.label}>Période</p>
            <Segmented
              className="mt-2"
              value={period}
              onChange={setPeriod}
              options={(Object.keys(PERIODS) as Period[]).map((k) => ({ value: k, label: PERIOD_SHORT[k] }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className={ui.label}>Mesure
              <select value={metric} onChange={(e) => { const m = e.target.value as Metric; setMetric(m); }} className={cn(sel, "normal-case tracking-normal")}>
                {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className={ui.label}>Sport
              <select value={type} onChange={(e) => setType(e.target.value)} className={cn(sel, "normal-case tracking-normal")}>
                <option value="">Tous sports</option>
                {sports.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {err && <p className="text-sm text-bad" role="alert">{err}</p>}

          <div className="grid gap-2">
            <button type="button" onClick={save} disabled={pending} className={cn(ui.btnPrimary, "w-full")}>Enregistrer</button>
            <button type="button" onClick={() => setConfirm(true)} disabled={pending} className={cn(ui.btnSecondary, "w-full text-bad")}>Retirer l’objectif</button>
          </div>
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title="Retirer cet objectif ?"
        message="Sa progression ne sera plus suivie."
        confirmLabel="Retirer"
        destructive
      />
    </>
  );
}
