import { cn } from "@/lib/utils";
import { HardMark } from "@/components/workout/hard-mark";
import type { SetGroup } from "@/lib/art/set-bars";

/** Zone des barres (px) et hauteur de la plus grande barre : la cible ne sort donc jamais de la zone. Fil : 60 / 56 ; fiche : plus haut. */
const SIZES = {
  card: { area: 60, top: 56, bar: 11 },
  detail: { area: 112, top: 104, bar: 16 },
} as const;

const total = (g: SetGroup) => g.sets.reduce((s, v) => s + v, 0);
const unit = (g: SetGroup) => (g.timed ? " s" : "");

/**
 * Séries de la séance (muscu : fil et fiche) : un groupe par exercice, une barre par série, hauteur = reps (secondes pour un exercice au chrono)
 * rapportée au maximum de la séance. Le pointillé marque la cible du jour (progression Lafay) ; sous la cible, la barre est estompée. Couleurs : tokens viz-strength-* (suivent le thème).
 * Sous chaque groupe : code de l'exercice et total. `size="detail"` (fiche) : barres plus hautes et nom de l'exercice sur 2 lignes sous le code.
 * Jamais dans une séance en cours (SetLogger).
 */
export function SetBars({ groups, size = "card", className }: { groups: SetGroup[]; size?: keyof typeof SIZES; className?: string }) {
  const { area, top, bar } = SIZES[size], detail = size === "detail";
  const label = groups.map((g) => `${g.name ?? g.code} : ${g.sets.length} séries, ${total(g)}${g.timed ? " secondes" : " répétitions"}`).join(" ; ");
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex w-full items-start justify-start gap-3 overflow-hidden bg-viz-strength-bg px-[18px] pb-2.5 pt-4",
        detail ? "pb-4" : "h-[116px] border-t border-line dark:border-t-0",
        className,
      )}
    >
      {groups.map((g, i) => {
        const scale = Math.max(g.max, g.target, 1), px = (v: number) => (v / scale) * top;
        return (
          <div key={i} className="flex min-w-0 flex-1 flex-col">
            <div className="relative flex items-end gap-[3px]" style={{ height: area, maxWidth: g.sets.length * (bar + 3) - 3 }}>
              {g.sets.map((reps, k) => (
                <span key={k} className={cn("min-w-0 flex-1 rounded-[3px]", reps < g.target ? "bg-viz-strength-bar-dim" : "bg-viz-strength-bar")} style={{ height: Math.max(2, px(reps)), maxWidth: bar }} />
              ))}
              <span className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-viz-target/50" style={{ bottom: px(g.target) }} />
            </div>
            {detail ? (
              <>
                <p className="mt-2 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap font-num">
                  {g.lafay !== false && <span className="min-w-0 truncate text-art-code text-viz-strength-code">{g.code}</span>}
                  <span className="shrink-0 text-art-total tabular-nums text-viz-strength-ink">{total(g)}{unit(g)}</span>
                </p>
                {g.name && <p className="mt-0.5 line-clamp-2 hyphens-auto text-xs leading-tight text-ink-soft">{g.name}</p>}
              </>
            ) : (
              <p className="mt-1 flex min-w-0 items-baseline gap-1.5 whitespace-nowrap font-num">
                <span className="min-w-0 truncate text-art-code text-viz-strength-code">{g.code}</span>
                <span className="shrink-0 text-art-total tabular-nums text-viz-strength-ink">{total(g)}{unit(g)}</span>
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type BarSet = { value: number; done: boolean; hard?: boolean };

/**
 * Séries d'un exercice (carte d'exercice de la fiche) : une colonne par série, barre pleine à la cible ou au-dessus, estompée en dessous,
 * pointillé à la cible ; série non faite = case vide en contour, « ✗ » dessous. La valeur réelle (reps, ou secondes) sous chaque barre, repère « Dur ».
 * Échelle propre à l'exercice (cible ou meilleure série) : la carte se lit par rapport à SA cible.
 */
export function ExerciseBars({ sets, target, timed, className }: { sets: BarSet[]; target: number; timed: boolean; className?: string }) {
  const AREA = 44, TOP = 40;
  const scale = Math.max(target, ...sets.map((s) => s.value), 1), px = (v: number) => (v / scale) * TOP;
  const label = sets.map((s, i) => `série ${i + 1} : ${s.done ? `${s.value}${timed ? " s" : ""}` : "non faite"}`).join(", ");
  return (
    <div className={cn("flex min-w-0 flex-col", className)} role="img" aria-label={`Cible ${target}${timed ? " s" : ""} par série ; ${label}`}>
      <div className="relative flex items-end gap-1.5" style={{ height: AREA }}>
        {sets.map((s, k) => (
          <div key={k} className="flex w-7 min-w-0 justify-center">
            {s.done
              ? <span className={cn("w-4 rounded-[3px]", s.value < target ? "bg-viz-strength-bar-dim" : "bg-viz-strength-bar")} style={{ height: Math.max(2, px(s.value)) }} />
              : <span className="w-4 rounded-[3px] border border-dashed border-ink-mute/60" style={{ height: px(target) }} />}
          </div>
        ))}
        <span className="pointer-events-none absolute left-0 border-t-2 border-dashed border-viz-target/40" style={{ bottom: px(target), width: `calc(${sets.length} * 1.75rem + ${sets.length - 1} * 0.375rem)`, maxWidth: "100%" }} />
      </div>
      <div className="mt-1 flex gap-1.5" aria-hidden>
        {sets.map((s, k) => (
          <span key={k} className={cn("w-7 min-w-0 whitespace-nowrap text-center font-num text-sm tabular-nums", !s.done ? "text-ink-mute" : s.value < target ? "text-ink-soft" : "text-ink")}>
            {s.done ? s.value : "✗"}{s.hard && <HardMark />}
          </span>
        ))}
      </div>
    </div>
  );
}
