"use client";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Échelle d'effort ressenti 1-10 (Borg CR-10 adaptée), du vert au rouge. `ink` : couleur du chiffre sur la pastille choisie. */
export const RPE: { v: number; label: string; color: string; ink: string }[] = [
  { v: 1, label: "Très facile", color: "#16A34A", ink: "#fff" },
  { v: 2, label: "Facile", color: "#22C55E", ink: "#052e16" },
  { v: 3, label: "Modéré", color: "#65A30D", ink: "#fff" },
  { v: 4, label: "Soutenu", color: "#84CC16", ink: "#1a2e05" },
  { v: 5, label: "Dur", color: "#EAB308", ink: "#422006" },
  { v: 6, label: "Dur +", color: "#F59E0B", ink: "#451a03" },
  { v: 7, label: "Très dur", color: "#F97316", ink: "#431407" },
  { v: 8, label: "Très dur +", color: "#EA580C", ink: "#fff" },
  { v: 9, label: "Extrême", color: "#EF4444", ink: "#fff" },
  { v: 10, label: "Maximal", color: "#DC2626", ink: "#fff" },
];

type Props = { value: number | null; onChange: (v: number | null) => void; className?: string };

/** Ligne « Effort » : 10 pastilles tactiles (44 px min), un second appui sur la pastille choisie l'efface. */
export function RpePicker({ value, onChange, className }: Props) {
  const current = value ? RPE[value - 1] : null;
  return (
    <div className={className}>
      <p className="mb-2 flex items-baseline justify-between text-sm text-ink-soft">
        <span className="font-semibold text-ink">Effort</span>
        {current ? (
          <span><span className="font-display text-base font-bold" style={{ color: current.color }}>{current.v}/10</span> · {current.label.toLowerCase()}</span>
        ) : (
          <span>Effort ressenti, de 1 à 10</span>
        )}
      </p>
      <div role="radiogroup" aria-label="Effort ressenti, de 1 à 10" className="grid grid-cols-5 gap-1.5">
        {RPE.map(({ v, label, color, ink }) => {
          const active = value === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${v}, ${label.toLowerCase()}`}
              onClick={() => { tap(10); onChange(active ? null : v); }}
              className={cn(
                "relative flex min-h-11 min-w-11 items-center justify-center overflow-hidden rounded-lg font-display text-lg font-bold tabular-nums transition active:scale-95",
                active ? "shadow-sm" : "bg-surface-2 text-ink-soft hover:text-ink"
              )}
              style={active ? { backgroundColor: color, color: ink } : undefined}
            >
              {v}
              {!active && <span className="absolute inset-x-0 bottom-0 h-1" style={{ backgroundColor: color, opacity: value != null && v <= value ? 1 : 0.45 }} aria-hidden />}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 flex justify-between text-xs text-ink-soft" aria-hidden><span>1 très facile</span><span>10 maximal</span></p>
    </div>
  );
}
