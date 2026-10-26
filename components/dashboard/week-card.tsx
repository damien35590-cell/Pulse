import { cn } from "@/lib/utils";
import { SPORT_SHORT } from "@/lib/sports";
import { ui } from "@/lib/ui";
import { fmtNum } from "@/lib/format";
import { Metric } from "@/components/ui/metric";

type Day = { label: string; run: number; lift: number; planned: boolean; today?: boolean };
type Props = {
  /** Sorties course / séances muscu faites et leur cible hebdo (réglages). */
  run: { done: number; target: number };
  lift: { done: number; target: number };
  /** Distance de la semaine face à l'objectif hebdo (km). */
  km: number;
  goalKm: number;
  days: Day[];
};

const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

/**
 * Semaine compacte : 3 chiffres (course, muscu, distance) puis 7 barres basses (minutes par jour, course en Volt, muscu en blanc cassé).
 * Une séance prévue non faite = contour pointillé neutre, jamais de rouge : le repos n'est pas une faute.
 */
export function WeekCard({ run, lift, km, goalKm, days }: Props) {
  const max = Math.max(...days.map((d) => d.run + d.lift), 60);
  const total = days.reduce((s, d) => s + d.run + d.lift, 0);
  const progress = goalKm > 0 ? Math.min(1, km / goalKm) : 0;
  return (
    <div className={cn(ui.card, "p-4")}>
      <dl className="grid grid-cols-3 gap-3">
        <Metric size="lg" label={SPORT_SHORT("RUN")} value={run.done} unit={`/ ${run.target}`} />
        <Metric size="lg" label="Muscu" value={lift.done} unit={`/ ${lift.target}`} />
        <Metric
          size="lg" label="Distance" value={fmtNum(km, 1)} unit={`/ ${fmtNum(goalKm, 0)} km`}
          hint={
            <span className="block h-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label="Objectif de distance" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
              <span className="block h-full rounded-full bg-brand" style={{ width: `${progress * 100}%` }} />
            </span>
          }
        />
      </dl>

      <div className="mt-4 grid grid-cols-7 gap-2" role="img" aria-label={`Temps d'entraînement : ${hm(total)} cette semaine`}>
        {days.map((d, i) => {
          const min = d.run + d.lift, h = (min / max) * 100;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className="flex h-10 w-full items-end">
                {min > 0 ? (
                  <div className={cn("flex w-full flex-col overflow-hidden rounded-md", d.today && "ring-2 ring-ink ring-offset-2 ring-offset-surface")} style={{ height: `${Math.max(h, 12)}%` }}>
                    {d.lift > 0 && <div className="bg-ink/80" style={{ flexGrow: d.lift }} />}
                    {d.run > 0 && <div className="bg-brand" style={{ flexGrow: d.run }} />}
                  </div>
                ) : d.planned ? (
                  <div className={cn("h-[40%] w-full rounded-md border-[1.5px] border-dashed", d.today ? "border-ink" : "border-line")} />
                ) : (
                  <div className={cn("h-1 w-full rounded-full", d.today ? "bg-ink-soft" : "bg-surface-2")} />
                )}
              </div>
              <span className={cn("text-[11px] leading-none", d.today ? "font-bold text-ink" : "font-medium text-ink-mute")}>{d.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-ink-mute">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />{SPORT_SHORT("RUN")}</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ink/80" />Muscu</span>
        </span>
        <span className="whitespace-nowrap font-num text-sm tabular-nums text-ink-soft">{hm(total)} au total</span>
      </div>
    </div>
  );
}
