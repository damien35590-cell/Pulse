"use client";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { VolumeBars } from "@/components/analysis/volume-bars";

type Week = { weekStart: string; reps: number; sets: number };
const OPTIONS = [{ value: "reps", label: "Reps" }, { value: "sets", label: "Séries" }] as const;

/** Volume hebdomadaire de musculation, commutable entre répétitions et séries. */
export function StrengthVolume({ weekly }: { weekly: Week[] }) {
  const [mode, setMode] = useState<"reps" | "sets">("reps");
  return (
    <div className="space-y-4">
      <Segmented options={OPTIONS} value={mode} onChange={setMode} />
      <VolumeBars weeks={weekly.map((w) => ({ weekStart: w.weekStart, value: w[mode] }))} unit={mode === "reps" ? "reps" : "séries"} />
    </div>
  );
}
