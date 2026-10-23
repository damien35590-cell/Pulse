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
  // Libellés espacés pour en garder ~6 au plus ; barres collées au-delà de 40 (jusqu'à 104 semaines sur un écran de téléphone)
  const n = weeks.length, step = n <= 4 ? 1 : n <= 12 ? 3 : n <= 26 ? 5 : Math.ceil(n / 6), gap = n > 40 ? "gap-px" : "gap-1";
  const name = (w: Bar) => w.label ?? fmtDayKey(w.weekStart);
  return (
    <div className="space-y-4">
      <div role="img" aria-label={`Volume par ${per}, en ${unit}`} className={cn("grid h-36 grid-flow-col auto-cols-fr items-end", gap)}>
        {weeks.map((w, i) => (
          <div key={w.weekStart} title={`${per === "mois" ? "" : "Semaine du "}${name(w)} : ${fmtNum(w.value, digits)} ${unit}`} className="flex h-full flex-col justify-end">
            {w.parts ? (
              <div className={cn("flex w-full flex-col-reverse overflow-hidden", n > 40 ? "rounded-t-sm" : "rounded-t-md")} style={{ height: `${Math.max(w.value ? 3 : 0, (w.value / max) * 100)}%` }}>
                {w.parts.filter((p) => p.value > 0).map((p) => <div key={p.cls} className={p.cls} style={{ height: `${(p.value / w.value) * 100}%` }} />)}
              </div>
            ) : (
              <div className={cn("w-full", n > 40 ? "rounded-t-sm" : "rounded-t-md", i === weeks.length - 1 ? "bg-brand" : "bg-brand/60")} style={{ height: `${Math.max(w.value ? 3 : 0, (w.value / max) * 100)}%` }} />
            )}
          </div>
        ))}
      </div>
      <div className={cn("grid grid-flow-col auto-cols-fr text-xs text-ink-mute", gap)} aria-hidden>
        {weeks.map((w, i) => <span key={w.weekStart} className="flex justify-center whitespace-nowrap">{(per === "mois" && n <= 12) || (n - 1 - i) % (per === "mois" ? Math.ceil(n / 8) : step) === 0 ? name(w) : ""}</span>)}
      </div>
      <p className="text-sm text-ink-soft">
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total, digits)}</span> {unit} au total, soit{" "}
        <span className="font-num font-semibold tabular-nums text-ink">{fmtNum(total / weeks.length, digits)}</span> par {per} en moyenne.
      </p>
    </div>
  );
}
