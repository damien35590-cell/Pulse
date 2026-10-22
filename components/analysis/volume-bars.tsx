import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Barres hebdomadaires aux tokens du thème : une par semaine de la période (0 compris), la semaine en cours en orange plein. */
export function VolumeBars({ weeks, unit, digits = 0 }: { weeks: { weekStart: string; value: number }[]; unit: string; digits?: number }) {
  const max = Math.max(...weeks.map((w) => w.value), 0.001), total = weeks.reduce((s, w) => s + w.value, 0);
  const step = weeks.length <= 4 ? 1 : weeks.length <= 12 ? 3 : 5;
  return (
    <div className="space-y-4">
      <div role="img" aria-label={`Volume par semaine, en ${unit}`} className="grid h-36 grid-flow-col auto-cols-fr items-end gap-1">
        {weeks.map((w, i) => (
          <div key={w.weekStart} title={`Semaine du ${lab(w.weekStart)} : ${fmtNum(w.value, digits)} ${unit}`} className="flex h-full flex-col justify-end">
            <div className={cn("w-full rounded-t-md", i === weeks.length - 1 ? "bg-brand" : "bg-brand/60")} style={{ height: `${Math.max(w.value ? 3 : 0, (w.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="grid grid-flow-col auto-cols-fr gap-1 text-xs text-ink-mute" aria-hidden>
        {weeks.map((w, i) => <span key={w.weekStart} className="flex justify-center whitespace-nowrap">{(weeks.length - 1 - i) % step === 0 ? lab(w.weekStart) : ""}</span>)}
      </div>
      <p className="text-sm text-ink-soft">
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total, digits)}</span> {unit} au total, soit{" "}
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total / weeks.length, digits)}</span> par semaine en moyenne.
      </p>
    </div>
  );
}
