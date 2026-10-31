"use client";
import { useId, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";

/**
 * Pied d'une carte d'exercice de muscu : rangée d'état (`children` : pastille + « Prochaine fois ») et, au bout, « ♥ Cardio » qui déplie
 * la FC par série (pic, récup) sous les barres. Replié par défaut (`defaultOpen` : démo) ; chaque carte garde son état. La pastille mesure 28 px, la zone de toucher 48 px.
 * Les colonnes de 28 px / 6 px d'écart reprennent celles d'`ExerciseBars` : chaque valeur est centrée sous sa barre.
 */
export function CardioToggle({ sets, children, defaultOpen = false }: { sets: { hrPeak?: number | null; hrEndRest?: number | null }[]; children?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const rows = [{ label: "pic", values: sets.map((s) => s.hrPeak) }, { label: "récup", values: sets.map((s) => s.hrEndRest) }];
  return (
    <>
      {open && (
        <div id={id} className="mt-2 space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center">
              <div className="flex gap-1.5">
                {r.values.map((v, i) => <span key={i} className="w-7 text-center font-num text-metric-sm tabular-nums text-ink-soft">{v ?? "–"}</span>)}
              </div>
              <span className="ml-3 text-label uppercase text-ink-mute">{r.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {children}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => { tap(6); setOpen((o) => !o); }}
          className={cn(ui.chip, "relative ml-auto select-none touch-manipulation transition duration-150 ease-snappy after:absolute after:-inset-y-2.5 after:inset-x-0 active:scale-95", open && "bg-surface-3 text-ink")}
        >
          <Heart className="size-3.5" aria-hidden />Cardio
        </button>
      </div>
    </>
  );
}
