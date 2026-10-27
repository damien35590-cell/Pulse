import type { RunProgramView, CoverGoal } from "@/lib/data/training";
import { fmtNum } from "@/lib/format";
import { fmtHms } from "@/lib/races/format";
import { VmaRow } from "@/components/training/program-actions";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Cercles concentriques de la couverture : de plus en plus transparents vers l'extérieur. */
const RINGS = [{ size: 72, o: 0.5 }, { size: 120, o: 0.36 }, { size: 168, o: 0.24 }, { size: 216, o: 0.14 }, { size: 264, o: 0.07 }];

const km = (v: number) => `${fmtNum(Math.round(v * 10) / 10)}`;

/**
 * Couverture du programme running : art-run-bg (règle 8, toujours sombre) avec la distance de l'objectif en géant ; sans objectif connu,
 * le nombre de semaines du programme. Sous l'art : nom, avancement, VMA. Aucune donnée n'est posée sur les cercles : ils restent décoratifs.
 */
export function RunCover({ p, goal }: { p: RunProgramView; goal: CoverGoal | null }) {
  const pct = p.totalCount ? Math.round((p.doneCount / p.totalCount) * 100) : 0;
  const big = goal ? `${fmtNum(Math.round(goal.km))}K` : String(p.totalWeeks);
  const line = goal ? `Objectif · ${km(goal.km)} km${goal.timeS ? ` sous ${fmtHms(goal.timeS)}` : ""}` : `Programme · ${p.totalWeeks} semaines`;
  return (
    <section aria-label="Programme running" className={cn(ui.card, "overflow-hidden")}>
      <div className="relative flex h-[140px] items-end overflow-hidden bg-art-run-bg px-4 pb-3">
        <div aria-hidden className="pointer-events-none absolute -right-10 top-1/2 size-0 -translate-y-1/2">
          {RINGS.map((r) => (
            <span key={r.size} className="absolute rounded-full border border-art-run-fg" style={{ width: r.size, height: r.size, left: -r.size / 2, top: -r.size / 2, opacity: r.o }} />
          ))}
        </div>
        <div className="relative">
          <p className="text-label uppercase text-art-ink-soft-run">{line}</p>
          <p aria-label={goal ? `${km(goal.km)} kilomètres` : `${p.totalWeeks} semaines`} className="font-num text-art-hero tabular-nums text-art-ink">{big}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="text-lg font-bold leading-tight text-ink">{p.name}{p.status === "PAUSED" && <span className="ml-2 align-middle text-label uppercase text-warn">en pause</span>}</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{p.totalWeeks} semaines · Bloc {p.current.block} {p.current.phaseName} · semaine {p.current.number}{p.current.isRecovery ? " · allégée" : ""}</p>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-sm text-ink-soft">
            <span className="font-num tabular-nums"><b className="text-base font-semibold text-ink">{p.doneCount}</b> / {p.totalCount} séances</span>
            <span className="font-num tabular-nums">{pct} %</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Séances faites ou passées">
            <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="-mb-1 border-t border-surface-2 pt-1"><VmaRow vmaKmh={p.vma.vmaKmh} label={p.vma.label} /></div>
      </div>
    </section>
  );
}
