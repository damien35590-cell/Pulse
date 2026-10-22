import { fmtDayKey, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Une barre. `weekStart` sert de clé et de libellé (un jour AAAA-MM-JJ) ; `label` le remplace (barres mensuelles).
 * `parts` : barre empilée (une couleur par sport, classes bg-stack-*) ; sa somme est la valeur.
 */
export type Bar = { weekStart: string; value: number; label?: string; parts?: { cls: string; value: number }[] };

/** Barres de volume aux tokens du thème : la dernière période en orange plein, les autres plus claires ; empilées si `parts` est fourni. */
export function VolumeBars({ weeks, unit, digits = 0, per = "semaine" }: { weeks: Bar[]; unit: string; digits?: number; per?: "semaine" | "mois" }) {
  const max = Math.max(...weeks.map((w) => w.value), 0.001), total = weeks.reduce((s, w) => s + w.value, 0);
  const step = weeks.length <= 4 ? 1 : weeks.length <= 12 ? 3 : 5;
  const name = (w: Bar) => w.label ?? fmtDayKey(w.weekStart);
  return (
    <div className="space-y-4">
      <div role="img" aria-label={`Volume par ${per}, en ${unit}`} className="grid h-36 grid-flow-col auto-cols-fr items-end gap-1">
        {weeks.map((w, i) => (
          <div key={w.weekStart} title={`${per === "mois" ? "" : "Semaine du "}${name(w)} : ${fmtNum(w.value, digits)} ${unit}`} className="flex h-full flex-col justify-end">
            {w.parts ? (
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${Math.max(w.value ? 3 : 0, (w.value / max) * 100)}%` }}>
                {w.parts.filter((p) => p.value > 0).map((p) => <div key={p.cls} className={p.cls} style={{ height: `${(p.value / w.value) * 100}%` }} />)}
              </div>
            ) : (
              <div className={cn("w-full rounded-t-md", i === weeks.length - 1 ? "bg-brand" : "bg-brand/60")} style={{ height: `${Math.max(w.value ? 3 : 0, (w.value / max) * 100)}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-flow-col auto-cols-fr gap-1 text-xs text-ink-mute" aria-hidden>
        {weeks.map((w, i) => <span key={w.weekStart} className="flex justify-center whitespace-nowrap">{per === "mois" || (weeks.length - 1 - i) % step === 0 ? name(w) : ""}</span>)}
      </div>
      <p className="text-sm text-ink-soft">
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total, digits)}</span> {unit} au total, soit{" "}
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total / weeks.length, digits)}</span> par {per} en moyenne.
      </p>
    </div>
  );
}
