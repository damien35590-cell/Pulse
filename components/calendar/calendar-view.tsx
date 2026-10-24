"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { monthGrid, shiftMonth, weekOf } from "@/lib/calendar";
import { shiftDay } from "@/lib/dates";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SessionStatus } from "@prisma/client";
import type { CalActivity, CalRace, CalSession, CalendarData } from "@/lib/data/calendar";

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DOW = ["L", "M", "M", "J", "V", "S", "D"];
const fmtDay = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { ...o, timeZone: "UTC" }).format(new Date(`${k}T00:00:00Z`));
const longDay = (k: string) => fmtDay(k, { weekday: "long", day: "numeric", month: "long" });
const shortDay = (k: string) => fmtDay(k, { weekday: "short", day: "numeric" });

type Day = { sessions: CalSession[]; races: CalRace[]; runs: CalActivity[]; workouts: CalActivity[] };
const empty = (): Day => ({ sessions: [], races: [], runs: [], workouts: [] });
const isEmpty = (d: Day) => !d.sessions.length && !d.races.length && !d.runs.length && !d.workouts.length;

const dot = "h-2 w-2 rounded-full";
const sessionDot = (s: CalSession) => (s.status === "COMPLETED" || s.status === "PARTIAL" ? "bg-emerald-500" : s.status === "SKIPPED" ? "bg-ink-soft/30" : s.isKey ? "bg-orange-500" : "bg-ink-soft/60");
const statusLabel: Record<SessionStatus, string> = { PLANNED: "Prévue", COMPLETED: "Faite", PARTIAL: "Partielle", MOVED: "Déplacée", SKIPPED: "Passée" };
const raceLabel = { REGISTERED: "Inscrit", COMPLETED: "Courue", DNS: "Absent", DNF: "Abandon" } as const;
const StarIcon = ({ className }: { className?: string }) => <Star className={cn("fill-amber-400 text-amber-500", className)} aria-hidden />;

export function CalendarView({ data, today }: { data: CalendarData; today: string }) {
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Day>();
    const get = (k: string) => { let d = m.get(k); if (!d) m.set(k, (d = empty())); return d; };
    data.sessions.forEach((s) => get(s.date).sessions.push(s));
    data.races.forEach((r) => get(r.date).races.push(r));
    data.activities.forEach((a) => (a.type === "RUN" ? get(a.date).runs : get(a.date).workouts).push(a));
    return m;
  }, [data]);

  const [y, mo] = anchor.split("-").map(Number);
  const grid = monthGrid(y, mo);
  const days = view === "month" ? grid.days : weekOf(anchor);
  const title = view === "month" ? `${MONTHS[mo - 1]} ${y}` : `${shortDay(days[0])} – ${shortDay(days[6])}`;

  /** Navigation bornée à la période chargée côté serveur. */
  const step = (n: number) => {
    let next: string;
    if (view === "week") next = shiftDay(anchor, 7 * n);
    else { const s = shiftMonth(y, mo, n); next = `${s.year}-${String(s.month).padStart(2, "0")}-01`; }
    if (next < data.from.slice(0, 7) + "-01" || next > data.to) return;
    setAnchor(next); setSelected(null);
  };
  const sel = selected ? byDay.get(selected) ?? empty() : null;
  const toggle = (k: string) => setSelected(selected === k ? null : k);

  return (
    <section aria-label="Calendrier" className="space-y-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold capitalize leading-none">{title}</h2>
        <div role="group" aria-label="Vue" className="flex rounded-xl bg-surface-2 p-0.5 text-sm font-semibold">
          {(["month", "week"] as const).map((v) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}
              className={cn("min-h-11 rounded-[10px] px-3", view === v ? "bg-surface shadow-sm" : "text-ink-soft")}>{v === "month" ? "Mois" : "Semaine"}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => step(-1)} aria-label="Précédent" className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2"><ChevronLeft className="h-5 w-5" /></button>
        <button type="button" onClick={() => { setAnchor(today); setSelected(today); }} className="min-h-11 flex-1 rounded-xl bg-surface-2 text-sm font-semibold">Aujourd’hui</button>
        <button type="button" onClick={() => step(1)} aria-label="Suivant" className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {view === "month" ? (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-soft" aria-hidden>{DOW.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((k) => {
              const d = byDay.get(k) ?? empty(), out = k < grid.first || k > grid.last, isSel = k === selected;
              return (
                <button key={k} type="button" onClick={() => toggle(k)} aria-label={longDay(k)} aria-pressed={isSel}
                  className={cn("flex min-h-11 min-w-0 flex-col items-center justify-start gap-0.5 rounded-lg border py-1 text-sm tabular-nums",
                    isSel ? "border-brand bg-brand/10" : "border-transparent bg-surface-2", out && "opacity-40", k === today && "ring-2 ring-brand")}>
                  <span className={cn("leading-none", k === today && "font-bold text-brand")}>{+k.slice(8)}</span>
                  <span className="flex min-h-3 flex-wrap items-center justify-center gap-0.5">
                    {d.races.length > 0 && <StarIcon className="h-3 w-3" />}
                    {d.sessions.length > 0 && <span className={cn(dot, sessionDot(d.sessions[0]))} />}
                    {d.runs.length > 0 && <span className={cn(dot, "bg-emerald-500")} />}
                    {d.workouts.length > 0 && <span className={cn(dot, "bg-violet-500")} />}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <ul className="space-y-1.5">
          {days.map((k) => {
            const d = byDay.get(k) ?? empty();
            return (
              <li key={k}>
                <button type="button" onClick={() => toggle(k)} aria-pressed={selected === k}
                  className={cn("flex min-h-11 w-full gap-3 rounded-xl border p-2 text-left", selected === k ? "border-brand bg-brand/10" : "border-transparent bg-surface-2", k === today && "ring-2 ring-brand")}>
                  <span className="w-12 shrink-0 text-xs font-semibold text-ink-soft first-letter:uppercase">{shortDay(k)}</span>
                  <span className="min-w-0 flex-1 space-y-1">
                    {isEmpty(d) && <span className="text-sm text-ink-soft">—</span>}
                    {d.races.map((r) => <Row key={r.id} icon={<StarIcon className="h-3.5 w-3.5" />} text={r.name} />)}
                    {d.sessions.map((s) => <Row key={s.id} icon={<span className={cn(dot, sessionDot(s))} />} text={s.title} meta={s.durationS ? fmtDuration(s.durationS) : undefined} />)}
                    {d.runs.map((a) => <Row key={a.id} icon={<span className={cn(dot, "bg-emerald-500")} />} text={a.title} meta={fmtDuration(a.durationS)} />)}
                    {d.workouts.map((a) => <Row key={a.id} icon={<span className={cn(dot, "bg-violet-500")} />} text={a.title} meta={fmtDuration(a.durationS)} />)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-soft" aria-label="Légende">
        <Leg c="bg-orange-500" t="Séance clé" /><Leg c="bg-ink-soft/60" t="Séance prévue" /><Leg c="bg-emerald-500" t="Course faite" /><Leg c="bg-violet-500" t="Muscu" />
        <li className="flex items-center gap-1"><StarIcon className="h-3 w-3" />Course objectif</li>
      </ul>

      {selected && sel && (
        <div className="space-y-1 rounded-xl border border-line bg-surface-2 p-3" role="region" aria-label={`Détail du ${longDay(selected)}`}>
          <p className="font-semibold first-letter:uppercase">{longDay(selected)}</p>
          {isEmpty(sel) && <p className="text-sm text-ink-soft">Rien de prévu ni de fait ce jour-là.</p>}
          {sel.races.map((r) => <Row key={r.id} icon={<StarIcon className="h-3.5 w-3.5" />} text={r.name} meta={raceLabel[r.status]} />)}
          {sel.sessions.map((s) => <Row key={s.id} icon={<span className={cn(dot, sessionDot(s))} />} text={s.title} meta={[statusLabel[s.status], s.isKey ? "clé" : null, s.durationS ? fmtDuration(s.durationS) : null].filter(Boolean).join(" · ")} />)}
          {sel.runs.map((a) => <Row key={a.id} icon={<span className={cn(dot, "bg-emerald-500")} />} text={a.title} meta={`Course · ${fmtDuration(a.durationS)}`} href={`/activities/${a.id}`} />)}
          {sel.workouts.map((a) => <Row key={a.id} icon={<span className={cn(dot, "bg-violet-500")} />} text={a.title} meta={`Muscu · ${fmtDuration(a.durationS)}`} href={`/activities/${a.id}`} />)}
        </div>
      )}
    </section>
  );
}

function Row({ icon, text, meta, href }: { icon: React.ReactNode; text: string; meta?: string; href?: string }) {
  const body = (
    <span className="flex min-h-6 items-center gap-2 text-sm">
      <span className="flex w-3.5 shrink-0 justify-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{text}</span>
      {meta && <span className="shrink-0 text-xs text-ink-soft">{meta}</span>}
    </span>
  );
  return href ? <Link href={href} className="flex min-h-11 items-center">{body}</Link> : <div>{body}</div>;
}

const Leg = ({ c, t }: { c: string; t: string }) => <li className="flex items-center gap-1"><span className={cn(dot, c)} />{t}</li>;
