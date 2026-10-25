import Link from "next/link";
import { ChevronRight, Pause, Rocket, Route } from "lucide-react";
import type { RunProgramView, SessionView } from "@/lib/data/training";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { PauseToggle, SessionActions, VmaTestPrompt } from "./program-actions";
import { SessionCarousel } from "./session-carousel";

/** « Bloc 1 · Semaine 2/4 — Base » */
export const weekLabel = (p: RunProgramView) =>
  `Bloc ${p.current.block} · Semaine ${p.current.weekInBlock}/${p.blockWeeks} — ${p.current.phaseName}${p.current.isRecovery ? " · allégée" : ""}`;

/** « Bloc 1 · Semaine 2/4 · Reprise & VMA » : pied de la carte d'accueil, le nom du programme y tient sans tronquer le libellé du haut. */
const blockLabel = (p: RunProgramView) =>
  `Bloc ${p.current.block} · Semaine ${p.current.weekInBlock}/${p.blockWeeks} · ${p.name}${p.current.isRecovery ? " · allégée" : ""}`;

export function KeyBadge() {
  return <span className="shrink-0 whitespace-nowrap rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">Séance clé</span>;
}

/** Points de la semaine du programme : faite (plein), passée (gris), prochaine (anneau), à venir (contour). */
export function WeekDots({ sessions }: { sessions: SessionView[] }) {
  return (
    <ol className="flex items-center gap-1.5" aria-label="Séances de la semaine">
      {sessions.map((s) => (
        <li key={s.id} title={s.title} aria-label={`${s.title} : ${s.status === "COMPLETED" ? "faite" : s.status === "SKIPPED" ? "passée" : "à faire"}`}
          className={cn("h-3 w-3 rounded-full",
            s.status === "COMPLETED" ? "bg-brand" : s.status === "SKIPPED" ? "bg-line" : s.isNext ? "border-2 border-brand" : "border-2 border-line")} />
      ))}
    </ol>
  );
}

export function NextSession({ s, paused }: { s: SessionView; paused?: boolean }) {
  return (
    <div className="space-y-3 rounded-xl bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Prochaine séance</p>
        {s.isKeySession && <KeyBadge />}
      </div>
      <div>
        <p className="font-display text-xl font-bold leading-tight">{s.title}</p>
        <p className="mt-1 text-sm">{s.summary}</p>
        <p className="mt-1 text-sm text-ink-soft">≈ {fmtDuration(s.durationS)}</p>
      </div>
      {!paused && <SessionActions id={s.id} />}
    </div>
  );
}

/** Séances encore à faire après la prochaine, dans l'ordre du programme (au plus `max`). */
function upcomingAfter(p: RunProgramView, max = 5) {
  if (!p.next) return [];
  const all = p.weeks.flatMap((w) => w.sessions).filter((s) => s.status === "PLANNED" && s.id !== p.next!.id);
  const from = (s: SessionView) => s.weekNumber * 100 + s.orderInWeek;
  const start = from(p.next);
  return all.filter((s) => from(s) > start).sort((a, b) => from(a) - from(b)).slice(0, max);
}

/** « Cette semaine », « Semaine prochaine », « Semaine 5 ». */
const whenLabel = (week: number, current: number) =>
  week === current ? "Cette semaine" : week === current + 1 ? "Semaine prochaine" : `Semaine ${week}`;

/** Aperçu d'une séance à venir (diapo du carrousel) : lecture seule, les actions restent sur la prochaine. */
function UpcomingSlide({ s, current }: { s: SessionView; current: number }) {
  return (
    <div className="flex h-full flex-col rounded-tile bg-surface-2/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label uppercase text-ink-mute">Ensuite · {whenLabel(s.weekNumber, current)}</p>
        {s.isKeySession && <KeyBadge />}
      </div>
      <p className="mt-1.5 text-xl font-bold leading-tight tracking-tight">{s.title}</p>
      <p className="mt-1 font-num text-sm tabular-nums text-ink-soft">≈ {fmtDuration(s.durationS)}</p>
      {s.summary && <p className="mt-1.5 line-clamp-3 text-sm leading-snug text-ink-soft">{s.summary}</p>}
    </div>
  );
}

/**
 * Carte « Programme course » de l'accueil : la prochaine séance en grand, sans bouton principal
 * (le Volt plein reste à la carte « Aujourd'hui » du coach, qui prend la course quand elle est du jour).
 */
export function ProgramCard({ p }: { p: RunProgramView }) {
  const week = p.weeks.find((w) => w.number === p.current.number);
  const paused = p.status === "PAUSED", n = p.next;
  const next = upcomingAfter(p);
  const vma = p.pendingTest ? <div className="relative mt-4"><VmaTestPrompt sessionId={p.pendingTest.sessionId} /></div> : null;
  const foot = <p className="truncate text-xs text-ink-mute">{blockLabel(p)}</p>;
  return (
    <section aria-label="Programme course" className={cn(ui.card, "relative overflow-hidden p-4 pb-0")}>
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-brand/[0.07] blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-label uppercase text-brand">{paused ? "Programme en pause" : "Prochaine séance"}</p>
          {!paused && n?.isKeySession && <KeyBadge />}
        </div>
        <Link href="/plan" className="-my-3 inline-flex h-12 shrink-0 items-center text-sm font-semibold text-brand active:opacity-60">Programme</Link>
      </div>
      {paused ? (
        <div className="relative mt-3 space-y-3">
          <p className="flex items-center gap-2 text-[15px] text-ink-soft"><Pause className="size-4 shrink-0" aria-hidden />Il t’attend, reprends quand tu veux.</p>
          <PauseToggle id={p.id} paused full />
        </div>
      ) : n ? (
        <SessionCarousel
          className="relative mt-1.5"
          slideIds={[n.id, ...next.map((s) => s.id)]}
          week={(week?.sessions ?? []).map((s) => ({ id: s.id, title: s.title, status: s.status }))}
          between={vma}
          footer={foot}
          count={`${p.weekDone}/${p.sessionsPerWeek}`}
        >
          <div>
            <h2 className="text-balance text-[28px] font-bold leading-tight tracking-tight">{n.title}</h2>
            {n.summary && <p className="mt-2 text-[15px] leading-snug text-ink-soft">{n.summary}</p>}
            <div className="mt-5"><SessionActions id={n.id} variant="card" /></div>
          </div>
          {next.map((s) => <UpcomingSlide key={s.id} s={s} current={p.current.number} />)}
        </SessionCarousel>
      ) : (
        <p className="relative mt-2 text-[15px] text-ink-soft">Programme terminé, bravo.</p>
      )}
      {(paused || !n) && (
        <>
          {vma}
          <div className="relative mt-4 flex items-center justify-between gap-3">
            <div className="min-w-0">{foot}</div>
            <div className="flex shrink-0 items-center gap-3">
              {week && <WeekDots sessions={week.sessions} />}
              <p className="font-num text-sm tabular-nums text-ink-soft">{p.weekDone}/{p.sessionsPerWeek}</p>
            </div>
          </div>
        </>
      )}
      <Link href="/itineraires" className="relative -mx-4 mt-4 flex min-h-12 touch-manipulation items-center gap-3 border-t border-line px-4 py-3 transition duration-150 ease-snappy active:bg-surface-2">
        <Route className="size-5 shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">Prépare ta sortie</span>
        <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
      </Link>
    </section>
  );
}

/** Sans programme actif. */
export function StartProgramCard() {
  return (
    <Link href="/plan" className={cn(ui.card, ui.pressCard, "flex items-center gap-3 p-4")}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-brand"><Rocket className="size-5" aria-hidden /></span>
      <span className="min-w-0 flex-1"><b className="block text-[15px] font-semibold">Lance ton programme course</b><span className="text-sm text-ink-soft">Reprise & VMA : 12 semaines, 2 ou 3 séances, à ton rythme</span></span>
      <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
    </Link>
  );
}
