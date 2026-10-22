"use client";
import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { TraceChart } from "@/components/activity/trace-chart";
import { fmtDayKey as dayLabel, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RidePoint } from "@/lib/analytics/cycling";

type Mode = "power" | "speed";
const TABLE_ROWS = 6;

/** Puissance (ou vitesse) sortie après sortie, au doigt ; en dessous, les dernières sorties avec puissance moyenne, normalisée, vitesse et FC. */
export function CyclingPerformance({ rides }: { rides: RidePoint[] }) {
  const [mode, setMode] = useState<Mode>("power");
  const withSpeed = rides.filter((r) => r.speedKmh != null);
  const series = mode === "power" ? rides : withSpeed;
  const options = withSpeed.length >= 3 ? ([{ value: "power", label: "Puissance" }, { value: "speed", label: "Vitesse" }] as const) : null;
  return (
    <div className="space-y-4">
      {options && <Segmented options={options} value={mode} onChange={setMode} />}
      {series.length >= 3 && (
        <TraceChart
          key={mode}
          values={series.map((r) => (mode === "power" ? r.avgPower : r.speedKmh!))}
          unit={mode === "power" ? "W" : "km/h"} label={mode === "power" ? "Puissance moyenne par sortie" : "Vitesse moyenne par sortie"}
          format={(v) => fmtNum(v, mode === "power" ? 0 : 1)} area={false} height={120}
          at={(f) => dayLabel(series[Math.round(f * (series.length - 1))].day)}
        />
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-label uppercase text-ink-mute">
            <tr><th className="py-2 pr-3 font-medium">Sortie</th><th className="px-2 py-2 text-right font-medium">P moy.</th><th className="px-2 py-2 text-right font-medium">PN</th><th className="px-2 py-2 text-right font-medium">km/h</th><th className="py-2 pl-2 text-right font-medium">FC</th></tr>
          </thead>
          <tbody className="divide-y divide-surface-2">
            {[...rides].reverse().slice(0, TABLE_ROWS).map((r) => (
              <tr key={r.id}>
                <td className="py-2.5 pr-3 text-ink-soft">{dayLabel(r.day)}{r.indoor && <span className="ml-1.5 text-xs text-ink-mute">intérieur</span>}</td>
                <td className="px-2 py-2.5 text-right font-num text-metric-sm text-ink">{r.avgPower}</td>
                <td className={cn("px-2 py-2.5 text-right font-num text-metric-sm", r.np ? "text-ink" : "text-ink-mute")}>{r.np ?? "–"}</td>
                <td className={cn("px-2 py-2.5 text-right font-num text-metric-sm", r.speedKmh ? "text-ink" : "text-ink-mute")}>{r.speedKmh ? fmtNum(r.speedKmh, 1) : "–"}</td>
                <td className={cn("py-2.5 pl-2 text-right font-num text-metric-sm", r.avgHr ? "text-ink" : "text-ink-mute")}>{r.avgHr ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
