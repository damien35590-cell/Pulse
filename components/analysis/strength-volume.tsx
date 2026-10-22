"use client";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

type Week = { weekStart: string; reps: number; sets: number };
const OPTIONS = [{ value: "reps", label: "Reps" }, { value: "sets", label: "Séries" }] as const;
const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Barres du volume hebdomadaire, une par semaine de la période (0 compris), commutables entre répétitions et séries. */
export function StrengthVolume({ weekly }: { weekly: Week[] }) {
  const [mode, setMode] = useState<"reps" | "sets">("reps");
  const values = weekly.map((w) => w[mode]), max = Math.max(...values, 1), total = values.reduce((s, v) => s + v, 0);
  const step = weekly.length <= 4 ? 1 : weekly.length <= 12 ? 3 : 5, unit = mode === "reps" ? "reps" : "séries";
  return (
    <div className="space-y-4">
      <Segmented options={OPTIONS} value={mode} onChange={setMode} />
      <div role="img" aria-label={`Volume par semaine, en ${unit}`} className="grid h-36 grid-flow-col auto-cols-fr items-end gap-1">
        {weekly.map((w, i) => (
          <div key={w.weekStart} title={`Semaine du ${lab(w.weekStart)} : ${fmtNum(w[mode], 0)} ${unit}`} className="flex h-full flex-col justify-end">
            <div className={cn("w-full rounded-t-md", i === weekly.length - 1 ? "bg-brand" : "bg-brand/60")} style={{ height: `${Math.max(w[mode] ? 3 : 0, (w[mode] / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="grid grid-flow-col auto-cols-fr gap-1 text-xs text-ink-mute" aria-hidden>
        {weekly.map((w, i) => <span key={w.weekStart} className="flex justify-center whitespace-nowrap">{(weekly.length - 1 - i) % step === 0 ? lab(w.weekStart) : ""}</span>)}
      </div>
      <p className="text-sm text-ink-soft">
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total, 0)}</span> {unit} au total, soit{" "}
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total / weekly.length, 0)}</span> par semaine en moyenne.
      </p>
    </div>
  );
}
