import type { ReactNode } from "react";
import { Rocket } from "lucide-react";
import type { CoverGoal, RunProgramView } from "@/lib/data/training";
import { RunProgramForm } from "@/components/training/run-program-form";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { GarminRow } from "./garmin-row";
import { PlanBars, type PlanWeek } from "./plan-bars";
import { RunCover } from "./run-cover";
import { RunNext } from "./run-next";
import { RunWeek, toWeekInfo } from "./run-week";

/** Onglet Running : couverture, prochaine séance, semaine en cours, calendrier (inchangé), plan par semaine, envoi sur Garmin. */
export function RunPanel({ p, goal, calendar }: { p: RunProgramView; goal: CoverGoal | null; calendar: ReactNode }) {
  const weeks: PlanWeek[] = p.weeks.map((w) => ({ ...toWeekInfo(w), block: w.block, phaseName: w.phaseName, weekInBlock: w.weekInBlock, volumeS: w.sessions.reduce((t, s) => t + s.durationS, 0) }));
  return (
    <div className="space-y-3">
      <RunCover p={p} goal={goal} />
      <RunNext p={p} />
      <RunWeek p={p} />
      {calendar}
      <PlanBars weeks={weeks} current={p.current.number} />
      <GarminRow programId={p.id} paused={p.status === "PAUSED"} syncedAt={p.intervalsSyncedAt} />
      <p className="px-1 text-xs text-ink-mute">Ce n’est pas un avis médical : ajustez selon vos sensations.</p>
    </div>
  );
}

/** Sans programme running : création de « Reprise & VMA », puis le calendrier reste visible dessous. */
export function RunEmpty({ vma, calendar }: { vma: { vmaKmh: number; label: string; estimated: boolean } | null; calendar: ReactNode }) {
  return (
    <div className="space-y-3">
      <section aria-label="Aucun programme running" className={cn(ui.card, "flex items-center gap-3 p-4")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-soft"><Rocket className="size-5" aria-hidden /></span>
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">Pas encore de programme running</h2>
          <p className="text-sm text-ink-soft">Reprise & VMA : 12 semaines, 2 ou 3 séances par semaine, à ton rythme.</p>
        </div>
      </section>
      <RunProgramForm current={vma} />
      {calendar}
    </div>
  );
}
