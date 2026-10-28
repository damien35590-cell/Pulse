"use client";
import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Mêmes bornes que zone() (lib/fitness.ts). */
const ZONES = [
  { range: "au-dessus de +20", label: "Transition", text: "tu récupères beaucoup, tu peux reprendre du volume" },
  { range: "+5 à +20", label: "Frais", text: "bon moment pour une séance clé ou une course" },
  { range: "−10 à +5", label: "Zone neutre", text: "charge stable" },
  { range: "−30 à −10", label: "Optimal", text: "tu encaisses du travail, c’est là qu’on progresse" },
  { range: "sous −30", label: "Risque élevé", text: "fatigue très forte, prévois du repos" },
];

/** « ? » discret à côté du titre du graphique de forme : explication un peu plus longue, en feuille. */
export function FormHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => { tap(); setOpen(true); }} aria-label="Comment lire ce graphique" className={cn(ui.iconBtn, "-my-3 text-ink-mute")}>
        <HelpCircle className="size-4" aria-hidden />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Lire la courbe de forme">
        <div className="mt-2 space-y-3 text-sm leading-relaxed text-ink-soft">
          <p>
            Chaque séance ajoute de la <b className="font-semibold text-ink">charge</b>. La <b className="font-semibold text-ink">fitness</b> en est la moyenne sur 6 semaines : elle monte
            lentement et redescend lentement. La <b className="font-semibold text-ink">fatigue</b> suit les 7 derniers jours : elle réagit vite.
          </p>
          <p>
            La <b className="font-semibold text-ink">forme</b>, c’est l’écart entre les deux. Une semaine chargée la fait plonger, quelques jours plus calmes la font remonter.
            Un peu négative, c’est normal quand tu t’entraînes : ce qui compte, c’est qu’elle ne reste pas très bas trop longtemps.
          </p>
          <p className={cn(ui.label, "pt-1")}>Repères</p>
          <ul className="space-y-1.5">
            {ZONES.map((z) => (
              <li key={z.label}>
                <span className="font-num tabular-nums text-ink">{z.range}</span> · <b className="font-semibold text-ink">{z.label}</b> : {z.text}.
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={() => setOpen(false)} className={cn(ui.btnSecondary, "mt-6 w-full bg-surface-3")}>Compris</button>
      </BottomSheet>
    </>
  );
}
