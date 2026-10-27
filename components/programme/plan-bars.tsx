"use client";
import { useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { SessionList, doneIn, weekDay, type WeekInfo } from "./week-rows";

export type PlanWeek = WeekInfo & { block: number; phaseName: string; weekInBlock: number; volumeS: number };

/** Hauteur d'une barre (px) : MAX pour la semaine la plus chargée, MIN_PART (30 %) de MAX pour la plus légère, proportionnel entre les deux. */
const MAX = 40, MIN_PART = 0.3;

/** Une semaine est « faite » quand toutes ses séances sont traitées (faites ou passées). */
const finished = (w: PlanWeek) => w.sessions.length > 0 && w.sessions.every((s) => s.status !== "PLANNED");

function stateOf(w: PlanWeek, current: number): "done" | "current" | "todo" {
  return w.number === current ? "current" : finished(w) ? "done" : "todo";
}

const minutes = (s: number) => Math.round(s / 60);

/**
 * « Le plan » : une barre par semaine, groupées par bloc. Hauteur = volume prévu (durée des séances), pleine = faite, contour = en cours,
 * plus claire = semaine allégée. Un appui ouvre la semaine (feuille avec les mêmes lignes que la carte de la semaine en cours).
 */
export function PlanBars({ weeks, current }: { weeks: PlanWeek[]; current: number }) {
  const [open, setOpen] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((w) => w.volumeS)), min = Math.min(...weeks.map((w) => w.volumeS));
  const heightOf = (v: number) => MAX * (max > min ? MIN_PART + (1 - MIN_PART) * ((v - min) / (max - min)) : 1);
  const blocks = [...new Set(weeks.map((w) => w.block))];
  const sel = weeks.find((w) => w.number === open) ?? null;

  return (
    <section aria-label="Le plan" className={cn(ui.card, "p-4")}>
      <h2 className="text-base font-bold text-ink">Le plan</h2>
      <div className="mt-3 space-y-3">
        {blocks.map((b) => {
          const list = weeks.filter((w) => w.block === b);
          return (
            <div key={b} role="group" aria-label={`Bloc ${b} ${list[0].phaseName}`}>
              <p className="mb-1 text-label uppercase text-ink-mute">Bloc {b} · <span className="text-ink-soft">{list[0].phaseName}</span></p>
              <div className="grid grid-cols-4 gap-1.5">
                {list.map((w) => {
                  const st = stateOf(w, current), h = heightOf(w.volumeS);
                  return (
                    <button key={w.number} type="button" onClick={() => { tap(); setOpen(w.number); }}
                      aria-label={`Semaine ${w.number}${w.isRecovery ? ", allégée" : ""}, ${minutes(w.volumeS)} minutes prévues, ${doneIn(w)} sur ${w.sessions.length} faites${st === "current" ? ", en cours" : ""}`}
                      className="flex min-h-14 touch-manipulation flex-col items-center justify-end gap-1 rounded-tile transition duration-150 ease-snappy active:scale-95 active:bg-surface-2">
                      <span aria-hidden className={cn("w-full rounded-md",
                        st === "done" && (w.isRecovery ? "bg-ink/50" : "bg-ink"),
                        st === "current" && cn("border-[1.5px]", w.isRecovery ? "border-ink/50" : "border-ink"),
                        st === "todo" && (w.isRecovery ? "bg-surface-3/50" : "bg-surface-3"))} style={{ height: h }} />
                      <span aria-hidden className={cn("font-num text-xs tabular-nums", st === "current" ? "font-bold text-ink" : "text-ink-mute")}>{w.number}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-mute">Hauteur = volume prévu · plein = fait · contour = en cours · clair = semaine allégée</p>

      <BottomSheet open={!!sel} onClose={() => setOpen(null)} title={sel ? `Semaine ${sel.number}` : undefined}>
        {sel && (
          <div className="pb-2">
            <p className="text-sm text-ink-soft">Bloc {sel.block} {sel.phaseName} · du {weekDay(sel.startDate)}{sel.isRecovery ? " · allégée" : ""} · <span className="font-num tabular-nums">{doneIn(sel)} / {sel.sessions.length}</span> faites</p>
            {sel.note && <p className="mt-1 text-sm text-ink-soft">{sel.note}</p>}
            <div className="mt-2"><SessionList sessions={sel.sessions} /></div>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}
