import type { RunProgramView, SessionView } from "@/lib/data/training";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { SessionList, doneIn, weekDay, type WeekInfo, type WeekSession } from "./week-rows";

export const toWeekSession = (s: SessionView): WeekSession => ({
  id: s.id, title: s.title, summary: s.summary, date: s.date, status: s.status, isKey: s.isKeySession, isNext: s.isNext, activityId: s.activityId, ribbon: s.ribbon,
});
export const toWeekInfo = (w: RunProgramView["weeks"][number]): WeekInfo => ({
  number: w.number, startDate: w.startDate, isRecovery: w.isRecovery, note: w.note, sessions: w.sessions.map(toWeekSession),
});

/** Semaine du programme en cours (celle de la prochaine séance) : « Semaine 2 · du 3 nov. » et « x / y ». */
export function RunWeek({ p }: { p: RunProgramView }) {
  const w = p.weeks.find((x) => x.number === p.current.number);
  if (!w) return null;
  const info = toWeekInfo(w);
  return (
    <section aria-label={`Semaine ${info.number}`} className={cn(ui.card, "p-4 pb-2")}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-ink">Semaine {info.number} <span className="font-normal text-ink-soft">· du {weekDay(info.startDate)}{info.isRecovery ? " · allégée" : ""}</span></h2>
        <p className="font-num text-sm tabular-nums text-ink-soft"><b className="text-base font-semibold text-ink">{doneIn(info)}</b> / {info.sessions.length}</p>
      </div>
      {info.note && <p className="mt-1 text-sm text-ink-soft">{info.note}</p>}
      <div className="mt-1"><SessionList sessions={info.sessions} /></div>
    </section>
  );
}
