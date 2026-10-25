"use client";
import { useState } from "react";
import { Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { fmtNum } from "@/lib/format";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Une case du calendrier : minutes d'activité du jour (0 = repos), `future` = jour pas encore arrivé (case vide). */
export type DayCell = { min: number; title?: string; future?: boolean };
type Mode = "calendar" | "days";
const DAYS = "LMMJVSD", FULL = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const OPTIONS = [{ value: "calendar" as Mode, label: "Calendrier" }, { value: "days" as Mode, label: "Jours" }];

/**
 * Bloc « Régularité » : calendrier de 26 semaines (une colonne par semaine, du lundi au dimanche) ou répartition par jour de la semaine.
 * `perWeek` : sorties par semaine, calculé comme le coach (activités / semaines de la période).
 */
export function RegularityCard({ cells, weekdays, perWeek, noun }: { cells: DayCell[]; /** Sorties de la période par jour (lundi → dimanche). */ weekdays: number[]; perWeek: number; noun: "sortie" | "séance" }) {
  const [mode, setMode] = useState<Mode>("calendar");
  const max = Math.max(...weekdays, 1), fav = weekdays.indexOf(Math.max(...weekdays));
  return (
    <Section title="Régularité">
      <div className={cn(ui.card, "space-y-4 p-4")}>
        <dl><Metric label={`${noun === "séance" ? "Séances" : "Sorties"} par semaine`} value={fmtNum(perWeek, 1)} size="lg" /></dl>
        <Segmented options={OPTIONS} value={mode} onChange={setMode} />
        {mode === "calendar" ? (
          <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label="Calendrier des 26 dernières semaines">
            {cells.map((d, i) => (
              <i key={i} title={d.title} className={cn("aspect-square rounded-[3px]", d.future ? "bg-transparent" : "bg-brand")} style={d.future ? undefined : { opacity: d.min ? Math.min(1, 0.3 + d.min / 120) : 0.07 }} />
            ))}
          </div>
        ) : (
          <div>
            <div className="grid h-24 grid-cols-7 items-end gap-1.5" role="img" aria-label={`${noun === "séance" ? "Séances" : "Sorties"} par jour de la semaine`}>
              {weekdays.map((v, r) => (
                <div key={r} className="flex h-full flex-col items-center justify-end gap-1.5 text-xs text-ink-soft">
                  <b className={cn("w-full rounded-md bg-brand", v > 0 && r !== fav && "opacity-40")} style={{ height: Math.max(4, (v / max) * 70) }} />{DAYS[r]}
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              {weekdays[fav] > 0 ? <>Ton jour préféré : <b className="text-ink">{FULL[fav]}</b>, {weekdays[fav]} {noun}{weekdays[fav] > 1 ? "s" : ""} sur la période.</> : "Pas encore de sorties sur cette période."}
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}
