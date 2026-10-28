import { AlertTriangle } from "lucide-react";
import { fmtNum } from "@/lib/format";
import type { WearLevel } from "@/lib/gear";
import { cn } from "@/lib/utils";

export const LEVEL_STYLE: Record<WearLevel, { bar: string; text: string; label: string }> = {
  ok: { bar: "bg-good", text: "text-ink-soft", label: "En forme" },
  warn: { bar: "bg-warn", text: "text-warn", label: "À surveiller" },
  critical: { bar: "bg-bad", text: "text-bad", label: "À remplacer" },
};

/** Jauge de durée de vie : km parcourus face au seuil critique ; sans seuil, simple compteur. */
export function WearGauge({ km, limitKm, level, name }: { km: number; limitKm: number | null; level: WearLevel; name: string }) {
  if (!limitKm) return <p className="font-display text-2xl font-bold tabular-nums">{fmtNum(km, 0)} km</p>;
  const pct = Math.round((km / limitKm) * 100), st = LEVEL_STYLE[level];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-2xl font-bold tabular-nums">{fmtNum(km, 0)}<span className="text-base font-semibold text-ink-soft"> / {fmtNum(limitKm, 0)} km</span></p>
        <p className={cn("inline-flex items-center gap-1 text-sm font-semibold tabular-nums", st.text)}>
          {level !== "ok" && <AlertTriangle className="h-4 w-4" aria-hidden />}{pct} %
        </p>
      </div>
      <div role="progressbar" aria-label={`Usure de ${name}`} aria-valuenow={Math.min(pct, 100)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${pct} % du seuil, ${st.label.toLowerCase()}`}
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn("h-full rounded-full", st.bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {level !== "ok" && <p className={cn("mt-1 text-xs font-medium", st.text)}>{level === "critical" ? `Seuil dépassé de ${fmtNum(km - limitKm, 0)} km : à remplacer.` : `Plus que ${fmtNum(limitKm - km, 0)} km avant le seuil.`}</p>}
    </div>
  );
}
