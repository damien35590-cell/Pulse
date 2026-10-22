"use client";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { VolumeBars } from "@/components/analysis/volume-bars";

type Month = { month: string; label: string; km: number; dPlus: number; hours: number };
type Mode = "km" | "dPlus" | "hours";
const OPTIONS = [{ value: "km", label: "Km" }, { value: "dPlus", label: "D+" }, { value: "hours", label: "Heures" }] as const;
const UNIT: Record<Mode, string> = { km: "km", dPlus: "m de D+", hours: "h" };

/** Volume mensuel de randonnée, commutable entre distance, dénivelé et temps. */
export function HikingVolume({ monthly }: { monthly: Month[] }) {
  const [mode, setMode] = useState<Mode>("km");
  return (
    <div className="space-y-4">
      <Segmented options={OPTIONS} value={mode} onChange={setMode} />
      <VolumeBars per="mois" weeks={monthly.map((m) => ({ weekStart: m.month, label: m.label, value: m[mode] }))} unit={UNIT[mode]} digits={mode === "hours" ? 1 : 0} />
    </div>
  );
}
