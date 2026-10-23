import Link from "next/link";
import { ChevronRight, Pause, Rocket } from "lucide-react";
import type { RunProgramView, SessionView } from "@/lib/data/training";
import { fmtDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { PauseToggle, SessionActions, VmaTestPrompt } from "./program-actions";
import { SessionCarousel } from "./session-carousel";

/** « Bloc 1 · Semaine 2/4 — Base » */
export const weekLabel = (p: RunProgramView) =>
  `Bloc ${p.current.block} · Semaine ${p.current.weekInBlock}/${p.blockWeeks} — ${p.current.phaseName}${p.current.isRecovery ? " · allégée" : ""}`;

/** Toujours encourageant : rien n'est dit d'une semaine incomplète, seulement ce qui est fait ou à portée. */
function cheer(done: number, target: number) {
  if (done >= target) return "Semaine bouclée, bravo 🎉";
  if (target - done === 1 && done > 0) return "Plus qu’une pour boucler la semaine 💪";
  if (done > 0) return "Bien lancé, continue comme ça";
  return null;
}

export function KeyBadge() {
  return <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">Séance clé</span>;
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
    <div className="flex h-full flex-col rounded-tile bg-surface-2 p-3">
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

/** Carte « Programme course » en tête de l'accueil : la prochaine séance en grand, un seul bouton principal. */
export function ProgramCard({ p }: { p: RunProgramView }) {
  const week = p.weeks.find((w) => w.number === p.current.number);
  const paused = p.status === "PAUSED", msg = cheer(p.weekDone, p.sessionsPerWeek), n = p.next;
  return (
    <section aria-label="Séance du jour" className={cn(ui.card, "relative overflow-hidden p-4")}>
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-brand/[0.07] blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-label uppercase text-brand">{paused ? "Programme en pause" : "Prochaine séance"} · {p.name}</p>
        <Link href="/plan" className="shrink-0 text-sm font-semibold text-brand active:opacity-60">Programme</Link>
      </div>
      {paused ? (
        <div className="relative mt-3 space-y-3">
          <p className="flex items-center gap-2 text-[15px] text-ink-soft"><Pause className="size-4 shrink-0" aria-hidden />Il t’attend, reprends quand tu veux.</p>
          <PauseToggle id={p.id} paused full />
        </div>
      ) : n ? (
        <SessionCarousel className="relative mt-1.5">
          <div>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight">{n.title}</h2>
            <p className="mt-1 font-num text-base tabular-nums text-ink-soft">≈ {fmtDuration(n.durationS)}{n.isKeySession ? " · séance clé" : ""}</p>
            {n.summary && <p className="mt-2 text-[15px] leading-snug text-ink-soft">{n.summary}</p>}
            <div className="mt-5"><SessionActions id={n.id} variant="card" /></div>
          </div>
          {upcomingAfter(p).map((s) => <UpcomingSlide key={s.id} s={s} current={p.current.number} />)}
        </SessionCarousel>
      ) : (
        <p className="relative mt-2 text-[15px] text-ink-soft">Programme terminé, bravo.</p>
      )}
      {p.pendingTest && <div className="relative mt-4"><VmaTestPrompt sessionId={p.pendingTest.sessionId} /></div>}
      <div className="relative mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-ink-mute">{weekLabel(p)}</p>
          {msg && <p className="mt-0.5 text-xs font-semibold text-brand">{msg}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {week && <WeekDots sessions={week.sessions} />}
          <p className="font-num text-sm tabular-nums text-ink-soft">{p.weekDone}/{p.sessionsPerWeek}</p>
        </div>
      </div>
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
