import { cn } from "@/lib/utils";
import type { SetGroup } from "@/lib/art/set-bars";

/** Zone des barres (px) et hauteur de la plus grande barre : la cible ne sort donc jamais de la zone. */
const AREA = 60, TOP = 56;

const total = (g: SetGroup) => g.sets.reduce((s, v) => s + v, 0);
const unit = (g: SetGroup) => (g.timed ? " s" : "");

/**
 * Séries de la séance (art, muscu du fil) : un groupe par exercice, une barre par série, hauteur = reps (secondes pour un exercice au chrono)
 * rapportée au maximum de la séance. Le pointillé marque la cible du jour (progression Lafay) ; sous la cible, la barre est à demi estompée.
 * Sous chaque groupe : code de l'exercice et total. Jamais dans une séance en cours (SetLogger).
 */
export function SetBars({ groups, className }: { groups: SetGroup[]; className?: string }) {
  const label = groups.map((g) => `${g.code} : ${g.sets.length} séries, ${total(g)}${g.timed ? " secondes" : " répétitions"}`).join(" ; ");
  return (
    <div role="img" aria-label={label} className={cn("flex h-[116px] w-full items-start justify-between gap-3 overflow-hidden bg-art-gym-bg px-[18px] pb-2.5 pt-4", className)}>
      {groups.map((g, i) => {
        const scale = Math.max(g.max, g.target, 1), px = (v: number) => (v / scale) * TOP;
        return (
          <div key={i} className="flex min-w-0 flex-col">
            <div className="relative flex items-end gap-1" style={{ height: AREA }}>
              {g.sets.map((reps, k) => (
                <span key={k} className={cn("w-[11px] min-w-0 shrink rounded-[3px] bg-art-gym-fg", reps < g.target && "opacity-50")} style={{ height: Math.max(2, px(reps)) }} />
              ))}
              <span className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-art-ink/50" style={{ bottom: px(g.target) }} />
            </div>
            <p className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap font-num">
              <span className="text-art-code text-art-gym-fg">{g.code}</span>
              <span className="text-art-total tabular-nums text-art-ink-soft-gym">{total(g)}{unit(g)}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
