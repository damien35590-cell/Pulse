import Link from "next/link";
import { ChevronRight, Footprints, Pause, Rocket } from "lucide-react";
import type { RunProgramView, SessionView } from "@/lib/data/training";
import { fmtDuration, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PauseToggle, SessionActions, VmaTestPrompt } from "./program-actions";

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

/** Carte « Programme course » en haut de la Home. */
export function ProgramCard({ p }: { p: RunProgramView }) {
  const week = p.weeks.find((w) => w.number === p.current.number);
  const paused = p.status === "PAUSED", msg = cheer(p.weekDone, p.sessionsPerWeek);
  return (
    <section aria-label="Programme course" className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft"><Footprints className="h-3.5 w-3.5" aria-hidden />Programme course</p>
        <Link href="/plan" className="-my-2 inline-flex min-h-11 items-center text-xs font-semibold text-brand">Voir le programme<ChevronRight className="h-4 w-4" aria-hidden /></Link>
      </div>
      <div>
        <h2 className="font-display text-2xl font-bold leading-none">{p.name}</h2>
        <p className="mt-1.5 text-sm text-ink-soft">{weekLabel(p)}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        {week && <WeekDots sessions={week.sessions} />}
        <p className="text-sm"><b className="font-display text-lg tabular-nums">{p.weekDone}/{p.sessionsPerWeek}</b> <span className="text-ink-soft">cette semaine</span></p>
      </div>
      {msg && <p className="text-sm font-semibold text-brand">{msg}</p>}

      {p.pendingTest && <VmaTestPrompt sessionId={p.pendingTest.sessionId} />}

      {paused ? (
        <div className="space-y-3 rounded-xl bg-surface-2 p-3">
          <p className="flex items-center gap-2 text-sm"><Pause className="h-4 w-4 text-ink-soft" aria-hidden />Programme en pause. Il t’attend, reprends quand tu veux.</p>
          <PauseToggle id={p.id} paused full />
        </div>
      ) : p.next ? (
        <NextSession s={p.next} />
      ) : null}
      <p className="text-xs text-ink-soft">Allures calculées pour une VMA de {fmtNum(p.vma.vmaKmh)} km/h</p>
    </section>
  );
}

/** Sans programme actif. */
export function StartProgramCard() {
  return (
    <Link href="/plan" className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface p-4 active:scale-[.99]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/10 text-brand"><Rocket className="h-5 w-5" aria-hidden /></span>
      <span className="min-w-0 flex-1"><b className="block">Lance ton programme course</b><span className="text-sm text-ink-soft">Reprise & VMA : 12 semaines, 2 ou 3 séances, à ton rythme</span></span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
    </Link>
  );
}
