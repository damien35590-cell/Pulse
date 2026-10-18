import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { fmtNum } from "@/lib/format";
import { Metric } from "@/components/ui/metric";

type Day = { label: string; run: number; lift: number; planned: boolean; today?: boolean };
type Props = { done: number; planned?: number; runKm: number; liftT: number; days: Day[] };

const hm = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;

/**
 * Semaine : 3 chiffres clés puis 7 barres (minutes par jour, course en orange, muscu en blanc cassé).
 * Une séance prévue non faite = contour pointillé neutre, jamais de rouge : le repos n'est pas une faute.
 */
export function WeekCard({ done, planned, runKm, liftT, days }: Props) {
  const max = Math.max(...days.map((d) => d.run + d.lift), 60);
  const total = days.reduce((s, d) => s + d.run + d.lift, 0);
  return (
    <div className={cn(ui.card, "p-4")}>
      <dl className="grid grid-cols-3 gap-3">
        <Metric size="xl" label="Séances" value={done} unit={planned ? `/ ${planned}` : undefined} />
        <Metric size="xl" label="Course" value={fmtNum(runKm, 1)} unit="km" />
        <Metric size="xl" label="Muscu" value={fmtNum(liftT, 1)} unit="t" />
      </dl>

      <div className="mt-6 grid h-24 grid-cols-7 items-end gap-2" role="img" aria-label={`Temps d'entraînement : ${hm(total)} cette semaine`}>
        {days.map((d, i) => {
          const min = d.run + d.lift, h = (min / max) * 100;
          return (
            <div key={i} className="flex h-full flex-col items-center justify-end gap-2">
              {min > 0 ? (
                <div className="flex w-full flex-col overflow-hidden rounded-md" style={{ height: `${Math.max(h, 10)}%` }}>
                  {d.lift > 0 && <div className="bg-ink/80" style={{ flexGrow: d.lift }} />}
                  {d.run > 0 && <div className="bg-brand" style={{ flexGrow: d.run }} />}
                </div>
              ) : d.planned ? (
                <div className={cn("h-[30%] w-full rounded-md border-[1.5px] border-dashed", d.today ? "border-brand/70" : "border-line")} />
              ) : (
                <div className="h-1 w-full rounded-full bg-surface-2" />
              )}
              <span className={cn("text-[11px] leading-none", d.today ? "font-bold text-ink" : "font-medium text-ink-mute")}>{d.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-ink-mute">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />Course</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ink/80" />Muscu</span>
        </span>
        <span className="font-num text-sm tabular-nums text-ink-soft">{hm(total)} au total</span>
      </div>
    </div>
  );
}
