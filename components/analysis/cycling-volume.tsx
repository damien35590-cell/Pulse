"use client";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { VolumeBars } from "@/components/analysis/volume-bars";

type Week = { weekStart: string; hours: number; km: number; load: number };
type Mode = "hours" | "km" | "load";
const ALL = [{ value: "hours", label: "Heures" }, { value: "km", label: "Km" }, { value: "load", label: "Charge" }] as const;
const UNIT: Record<Mode, string> = { hours: "h", km: "km", load: "pts de charge" };

/** Volume hebdomadaire du vélo : heures par défaut ; « Charge » (TSS) seulement si au moins une sortie en a une. */
export function CyclingVolume({ weekly, hasLoad }: { weekly: Week[]; hasLoad: boolean }) {
  const [mode, setMode] = useState<Mode>("hours");
  return (
    <div className="space-y-4">
      <Segmented options={hasLoad ? ALL : ALL.filter((o) => o.value !== "load")} value={mode} onChange={setMode} />
      <VolumeBars weeks={weekly.map((w) => ({ weekStart: w.weekStart, value: w[mode] }))} unit={UNIT[mode]} digits={mode === "hours" ? 1 : 0} />
    </div>
  );
}
