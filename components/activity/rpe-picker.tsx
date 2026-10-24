"use client";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Échelle d'effort ressenti 1-10 (Borg CR-10 adaptée). */
export const RPE: { v: number; label: string }[] = [
  { v: 1, label: "Très facile" }, { v: 2, label: "Facile" }, { v: 3, label: "Modéré" }, { v: 4, label: "Soutenu" }, { v: 5, label: "Dur" },
  { v: 6, label: "Dur +" }, { v: 7, label: "Très dur" }, { v: 8, label: "Très dur +" }, { v: 9, label: "Extrême" }, { v: 10, label: "Maximal" },
];

/** Tonalité du chiffre choisi : vert jusqu'à 4, ambre jusqu'à 7, rouge au-delà. */
export const rpeTone = (v: number) => (v <= 4 ? "text-good" : v <= 7 ? "text-warn" : "text-bad");

type Props = { value: number | null; onChange: (v: number | null) => void; className?: string };

/**
 * Ligne « Effort » : 10 pastilles sur une seule ligne, sans défilement. Chaque cible fait toute la hauteur (48 px) et toute sa part
 * de largeur (pas d'espace mort entre les pastilles). Un dégradé good → warn → bad (tokens) remplit les pastilles jusqu'à la valeur
 * choisie ; chaque pastille montre sa tranche du dégradé. Un second appui sur la pastille choisie l'efface.
 */
export function RpePicker({ value, onChange, className }: Props) {
  const current = value ? RPE[value - 1] : null;
  return (
    <div className={className}>
      <p className="mb-1 flex items-baseline justify-between text-sm text-ink-soft">
        <span className="font-semibold text-ink">Effort</span>
        {current ? (
          <span><span className={cn("font-num text-metric-sm tabular-nums", rpeTone(current.v))}>{current.v}/10</span> · {current.label.toLowerCase()}</span>
        ) : (
          <span>Effort ressenti, de 1 à 10</span>
        )}
      </p>
      <div role="radiogroup" aria-label="Effort ressenti, de 1 à 10" className="flex">
        {RPE.map(({ v, label }, i) => {
          const active = value === v, filled = value != null && v <= value;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${v}, ${label.toLowerCase()}`}
              onClick={() => { tap(); onChange(active ? null : v); }}
              className="group flex h-12 min-w-0 flex-1 items-center px-0.5 select-none touch-manipulation"
            >
              <span
                className={cn(
                  "grid h-9 w-full place-items-center rounded-full font-num text-metric-sm tabular-nums transition duration-150 ease-snappy group-active:scale-90",
                  filled ? "bg-gradient-to-r from-good via-warn to-bad text-brand-ink" : "bg-surface-2 text-ink-soft",
                  active && "scale-110 ring-2 ring-ink/70",
                )}
                // Dégradé à l'échelle de la ligne entière : la pastille i en affiche la i-ème tranche.
                style={filled ? { backgroundSize: `${RPE.length * 100}% 100%`, backgroundPosition: `${(i / (RPE.length - 1)) * 100}% 0` } : undefined}
              >
                {v}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1 flex justify-between text-xs text-ink-mute" aria-hidden><span>1 très facile</span><span>10 maximal</span></p>
    </div>
  );
}
