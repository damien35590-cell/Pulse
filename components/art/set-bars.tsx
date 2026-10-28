import { cn } from "@/lib/utils";
import type { SetGroup } from "@/lib/art/set-bars";

/** Zone des barres (px) et hauteur de la plus grande barre : la cible ne sort donc jamais de la zone. */
const AREA = 60, TOP = 56;

const total = (g: SetGroup) => g.sets.reduce((s, v) => s + v, 0);
const unit = (g: SetGroup) => (g.timed ? " s" : "");

/**
 * Séries de la séance (art, muscu du fil) : un groupe par exercice, une barre par série, hauteur = reps (secondes pour un exercice au chrono)
 * rapportée au maximum de la séance. Le pointillé marque la cible du jour (progression Lafay) ; sous la cible, la barre est estompée. Couleurs : tokens viz-strength-* (suivent le thème).
 * Sous chaque groupe : code de l'exercice et total. Jamais dans une séance en cours (SetLogger).
 */
export function SetBars({ groups, className }: { groups: SetGroup[]; className?: string }) {
  const label = groups.map((g) => `${g.code} : ${g.sets.length} séries, ${total(g)}${g.timed ? " secondes" : " répétitions"}`).join(" ; ");
  return (
    <div role="img" aria-label={label} className={cn("flex h-[116px] w-full items-start justify-start gap-3 overflow-hidden border-t border-line bg-viz-strength-bg px-[18px] dark:border-t-0 pb-2.5 pt-4", className)}>
      {groups.map((g, i) => {
        const scale = Math.max(g.max, g.target, 1), px = (v: number) => (v / scale) * TOP;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col">
            <div className="relative flex items-end gap-[3px]" style={{ height: AREA, maxWidth: g.sets.length * 14 - 3 }}>
              {g.sets.map((reps, k) => (
                <span key={k} className={cn("min-w-0 max-w-[11px] flex-1 rounded-[3px]", reps < g.target ? "bg-viz-strength-bar-dim" : "bg-viz-strength-bar")} style={{ height: Math.max(2, px(reps)) }} />
              ))}
              <span className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-viz-target/50" style={{ bottom: px(g.target) }} />
            </div>
            <p className="mt-1 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap font-num">
              <span className="min-w-0 truncate text-art-code text-viz-strength-code">{g.code}</span>
              <span className="shrink-0 text-art-total tabular-nums text-viz-strength-ink">{total(g)}{unit(g)}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
