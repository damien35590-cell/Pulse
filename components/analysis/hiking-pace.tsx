"use client";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { TraceChart } from "@/components/activity/trace-chart";
import { fmtDayKey, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HikePoint } from "@/lib/analytics/hiking";

type Mode = "climb" | "speed";
const TABLE_ROWS = 6;

/** Rythme en montée (m de D+ par heure) ou vitesse moyenne, rando après rando ; en dessous, les dernières sorties avec leur FC. */
export function HikingPace({ hikes }: { hikes: HikePoint[] }) {
  const [mode, setMode] = useState<Mode>("climb");
  const key = mode === "climb" ? "climbRate" : "speedKmh";
  const series = hikes.filter((h) => h[key] != null);
  const options = hikes.some((h) => h.climbRate != null) && hikes.some((h) => h.speedKmh != null) ? ([{ value: "climb", label: "Montée" }, { value: "speed", label: "Vitesse" }] as const) : null;
  return (
    <div className="space-y-4">
      {options && <Segmented options={options} value={mode} onChange={setMode} />}
      {series.length >= 3 && (
        <TraceChart
          key={mode} values={series.map((h) => h[key]!)} unit={mode === "climb" ? "m/h" : "km/h"} label={mode === "climb" ? "Vitesse ascensionnelle par rando" : "Vitesse moyenne par rando"}
          format={(v) => fmtNum(v, mode === "climb" ? 0 : 1)} area={false} height={120}
          at={(f) => fmtDayKey(series[Math.round(f * (series.length - 1))].day)}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-label uppercase text-ink-mute">
            <tr><th className="py-2 pr-3 font-medium">Sortie</th><th className="px-2 py-2 text-right font-medium">m/h</th><th className="px-2 py-2 text-right font-medium">km/h</th><th className="py-2 pl-2 text-right font-medium">FC</th></tr>
          </thead>
          <tbody className="divide-y divide-surface-2">
            {[...hikes].reverse().slice(0, TABLE_ROWS).map((h) => (
              <tr key={h.id}>
                <td className="py-2.5 pr-3 text-ink-soft">{fmtDayKey(h.day)}</td>
                <td className={cn("px-2 py-2.5 text-right font-num text-metric-sm", h.climbRate ? "text-ink" : "text-ink-mute")}>{h.climbRate ? fmtNum(h.climbRate, 0) : "–"}</td>
                <td className={cn("px-2 py-2.5 text-right font-num text-metric-sm", h.speedKmh ? "text-ink" : "text-ink-mute")}>{h.speedKmh ? fmtNum(h.speedKmh, 1) : "–"}</td>
                <td className={cn("py-2.5 pl-2 text-right font-num text-metric-sm", h.avgHr ? "text-ink" : "text-ink-mute")}>{h.avgHr ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
