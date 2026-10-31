import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { MUSCLE_IDS, MUSCLE_NAME, type MuscleId, type MuscleLevels, type MuscleLoad } from "@/lib/workout/body";
import { BodyMap, MuscleLegend } from "./body-map";
import { muscleFill } from "./body-shapes";

/** Séries par semaine qui donnent la pleine couleur : l'ordre de grandeur courant pour faire progresser un muscle. */
export const FULL_SETS_PER_WEEK = 10;

/**
 * « Muscles sollicités » (page Analyse, muscu) : face et dos côte à côte, couleur = séries par semaine sur la période
 * (principal = 1 série, secondaire = ½ ; pleine couleur à FULL_SETS_PER_WEEK), puis la liste des muscles travaillés, du plus au moins.
 */
export function MuscleVolume({ data, weeks, span }: { data: Record<MuscleId, MuscleLoad>; weeks: number; span: string }) {
  const perWeek = (id: MuscleId) => data[id].sets / Math.max(1, weeks);
  const worked = MUSCLE_IDS.filter((id) => data[id].sets > 0).sort((a, b) => data[b].sets - data[a].sets);
  const levels: MuscleLevels = Object.fromEntries(worked.map((id) => [id, Math.min(1, perWeek(id) / FULL_SETS_PER_WEEK)]));
  if (!worked.length) return <p className="text-sm text-ink-soft">Aucune séance de musculation sur {span}.</p>;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <BodyMap size="md" view="front" flip={false} intensity={levels} className="h-56" />
        <BodyMap size="md" view="back" flip={false} intensity={levels} className="h-56" />
      </div>
      <MuscleLegend kind="volume" max={`${FULL_SETS_PER_WEEK} séries/sem.`} className="mt-3 justify-center" />
      <p className={cn(ui.label, "mt-5")}>Séries par semaine</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
        {worked.map((id) => (
          <li key={id} className="min-w-0">
            <p className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate text-ink">{MUSCLE_NAME[id]}</span>
              <span className="shrink-0 font-num tabular-nums text-ink-soft">{fmtNum(perWeek(id), 1)}</span>
            </p>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full" style={{ width: `${Math.max(4, Math.round(levels[id]! * 100))}%`, background: muscleFill(levels[id]!) }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-mute">
        Séries par semaine sur {span} : un muscle principal compte une série, un secondaire une demi-série. Pleine couleur à {FULL_SETS_PER_WEEK} séries par semaine.
      </p>
    </div>
  );
}
