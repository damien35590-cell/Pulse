import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { MUSCLE_IDS, MUSCLE_NAME, shareStep, type MuscleId, type MuscleLoad, type MuscleStep } from "@/lib/workout/body";
import { BodyPair, MuscleLegend } from "./body-map";
import { STEP_BG } from "./body-shapes";

/**
 * « Muscles sollicités » (page Analyse, muscu) : face et dos côte à côte, couleur = séries par semaine sur la période
 * (principal = 1 série, secondaire = ½), en 4 paliers rapportés au muscle le plus travaillé de la période : un volume modeste
 * (2 à 5 séries/sem.) garde des écarts lisibles. Légende en valeurs réelles, puis la liste des muscles, du plus au moins.
 */
export function MuscleVolume({ data, weeks, span }: { data: Record<MuscleId, MuscleLoad>; weeks: number; span: string }) {
  const perWeek = (id: MuscleId) => data[id].sets / Math.max(1, weeks);
  const worked = MUSCLE_IDS.filter((id) => data[id].sets > 0).sort((a, b) => data[b].sets - data[a].sets);
  if (!worked.length) return <p className="text-sm text-ink-soft">Aucune séance de musculation sur {span}.</p>;
  const max = perWeek(worked[0]), min = perWeek(worked.at(-1)!);
  const steps = Object.fromEntries(worked.map((id) => [id, shareStep(perWeek(id) / max)])) as Partial<Record<MuscleId, MuscleStep>>;
  return (
    <div>
      <BodyPair steps={steps} />
      <MuscleLegend kind="volume" min={fmtNum(min, 1)} max={`${fmtNum(max, 1)} séries/sem.`} className="mt-3 justify-center" />
      <p className={cn(ui.label, "mt-5")}>Séries par semaine</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {worked.map((id) => (
          <li key={id} className="min-w-0">
            <p className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-ink">{MUSCLE_NAME[id]}</span>
              <span className="shrink-0 font-num tabular-nums text-ink-soft">{fmtNum(perWeek(id), 1)}</span>
            </p>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className={cn("block h-full rounded-full", STEP_BG[steps[id]!])} style={{ width: `${Math.max(4, Math.round((perWeek(id) / max) * 100))}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-mute">
        Séries par semaine sur {span} : un muscle principal compte une série, un secondaire une demi-série. Couleur rapportée au muscle le plus travaillé de la période.
      </p>
    </div>
  );
}
