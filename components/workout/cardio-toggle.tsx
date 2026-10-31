"use client";
import { useId, useState } from "react";
import { ChevronDown, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";

/**
 * Pied d'une carte d'exercice de muscu : rangée d'état (`children` : pastille + « Prochaine fois ») et, au bout, « ♡ Cardio ⌄ » qui déplie
 * la FC par série sous les barres. Replié par défaut (`defaultOpen` : démo) ; chaque carte garde son état. Cœur toujours en contour (pas un « j'aime »),
 * chevron qui se retourne ; ouverte, la pastille passe en `surface-3`. Pastille de 28 px, zone de toucher de 48 px.
 * Tableau : un encart `surface-2` sous les barres, une ligne par mesure (libellé au-dessus, valeurs dessous). Les colonnes de 28 px / 6 px d'écart reprennent celles
 * d'`ExerciseBars` et l'encart déborde de 12 px dans le padding de la carte : chaque valeur reste centrée sous sa barre.
 * « Pic » : maximum de la FC autour de la série ; « Fin du repos » : FC moyenne des 4 dernières secondes du repos pris (lib/workout/hr.ts).
 */
export function CardioToggle({ sets, children, defaultOpen = false }: { sets: { hrPeak?: number | null; hrEndRest?: number | null }[]; children?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const rows = [
    { label: "Pic (bpm)", values: sets.map((s) => s.hrPeak), tone: "text-ink-soft" },
    { label: "Fin du repos (bpm)", values: sets.map((s) => s.hrEndRest), tone: "text-ink-mute" },
  ];
  return (
    <>
      {open && (
        <div id={id} className="-mx-3 mt-3 space-y-2 rounded-tile bg-surface-2 p-3">
          {rows.map((r) => (
            <div key={r.label}>
              <p className="text-label text-ink-mute">{r.label}</p>
              <div className="mt-1 flex gap-1.5">
                {r.values.map((v, i) => <span key={i} className={cn("w-7 text-center font-num text-xs tabular-nums", r.tone)}>{v ?? "–"}</span>)}
              </div>
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
          <ChevronDown className={cn("-mr-0.5 size-3.5 transition-transform duration-150 ease-snappy", open && "rotate-180")} aria-hidden />
        </button>
      </div>
    </>
  );
}
