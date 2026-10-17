import Link from "next/link";
import { Check, ChevronRight, Circle, SkipForward } from "lucide-react";
import type { RunProgramView as View, SessionView } from "@/lib/data/training";
import { fmtDuration, fmtNum } from "@/lib/format";
import { fmtPaceS, fmtStepTime } from "@/lib/training/resolve";
import { cn } from "@/lib/utils";
import { KeyBadge, NextSession, WeekDots, weekLabel } from "./program-card";
import { PauseToggle, VmaTestPrompt, VmaUpdate } from "./program-actions";
import { RunProgramForm } from "./run-program-form";

const ROLE = { warmup: "Échauffement", active: "Effort", recovery: "Récup", cooldown: "Retour au calme", rest: "Repos" } as const;
const weekDay = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/** Détail des étapes, répétitions regroupées : « 10 × 400 m · 3:59–4:13 /km ». */
function Steps({ s }: { s: SessionView }) {
  const rows: { key: string; label: string; what: string; pace?: string }[] = [];
  for (const st of s.steps) {
    if (st.repeat && st.repeat.current > 1) continue;
    const what = st.duration.type === "time" ? fmtStepTime(st.duration.s) : st.duration.type === "distance" ? `${st.duration.m} m` : "1 tour";
    rows.push({
      key: `${rows.length}`, label: st.repeat ? `${st.repeat.total} × ${ROLE[st.role].toLowerCase()}` : ROLE[st.role], what,
      pace: st.paceSPerKm && (Math.round(st.paceSPerKm.min) === Math.round(st.paceSPerKm.max) ? `${fmtPaceS(st.paceSPerKm.min)} /km` : `${fmtPaceS(st.paceSPerKm.min)}–${fmtPaceS(st.paceSPerKm.max)} /km`),
    });
  }
  return (
    <details className="text-sm">
      <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-brand">Détail des étapes</summary>
      <dl className="divide-y divide-line rounded-lg border border-line">
        {rows.map((r) => <div key={r.key} className="flex items-baseline justify-between gap-3 px-3 py-2"><dt className="text-ink-soft">{r.label} · {r.what}</dt><dd className="shrink-0 font-semibold tabular-nums">{r.pace ?? ""}</dd></div>)}
      </dl>
      {s.description && <p className="mt-2 text-ink-soft">{s.description}</p>}
    </details>
  );
}

function SessionRow({ s }: { s: SessionView }) {
  const Icon = s.status === "COMPLETED" ? Check : s.status === "SKIPPED" ? SkipForward : Circle;
  return (
    <li className={cn("flex gap-3 px-3 py-3", s.status === "SKIPPED" && "opacity-60")}>
      <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full", s.status === "COMPLETED" ? "bg-brand text-brand-ink" : "text-ink-soft")}>
        <Icon className={cn(s.status === "PLANNED" ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-tight">{s.title}</p>
          {s.isKeySession && <KeyBadge />}
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">{s.summary}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {s.status === "COMPLETED" ? "Faite" : s.status === "SKIPPED" ? "Passée" : `≈ ${fmtDuration(s.durationS)}`}
          {s.activityId && <> · <Link href={`/activities/${s.activityId}`} className="font-semibold text-brand">Voir la sortie</Link></>}
        </p>
      </div>
    </li>
  );
}

export function RunProgramView({ p }: { p: View }) {
  const paused = p.status === "PAUSED", pct = Math.round((p.doneCount / p.totalCount) * 100);
  const blocks = [...new Set(p.weeks.map((w) => w.block))];
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Programme course{paused ? " · en pause" : ""}</p>
          <h2 className="mt-1 font-display text-2xl font-bold leading-none">{p.name}</h2>
          <p className="mt-1.5 text-sm text-ink-soft">{weekLabel(p)}</p>
          {p.current.phaseFocus && <p className="mt-0.5 text-sm text-ink-soft">{p.current.phaseFocus}</p>}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs text-ink-soft"><span>{p.doneCount} séances sur {p.totalCount}</span><span className="tabular-nums">{pct} %</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
        </div>
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-sm">VMA actuelle : <b className="font-display text-lg tabular-nums">{fmtNum(p.vma.vmaKmh)} km/h</b> <span className="text-ink-soft">({p.vma.label})</span></p>
          <p className="text-xs text-ink-soft">Toutes les allures du programme en découlent et suivent ta VMA.</p>
          <VmaUpdate current={p.vma.vmaKmh} />
        </div>
        {p.pendingTest && <VmaTestPrompt sessionId={p.pendingTest.sessionId} />}
        {p.next && <NextSession s={p.next} paused={paused} />}
        {p.next && <Steps s={p.next} />}
        <PauseToggle id={p.id} paused={paused} full />
      </section>

      {blocks.map((b) => {
        const weeks = p.weeks.filter((w) => w.block === b);
        return (
          <section key={b} className="space-y-2.5" aria-label={`Bloc ${b}`}>
            <h2 className="font-display text-xl font-bold">Bloc {b} <span className="font-normal text-ink-soft">— {weeks[0].phaseName}</span></h2>
            {weeks.map((w) => (
              <details key={w.number} open={w.number === p.current.number} className="overflow-hidden rounded-xl border border-line bg-surface">
                <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-3 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="font-semibold">Semaine {w.number}</span>
                    <span className="text-sm text-ink-soft"> · du {weekDay(w.startDate)}{w.isRecovery ? " · allégée" : ""}</span>
                  </span>
                  <span className="flex items-center gap-2"><WeekDots sessions={w.sessions} /><ChevronRight className="h-4 w-4 text-ink-soft" aria-hidden /></span>
                </summary>
                {w.note && <p className="border-t border-line px-3 py-2 text-sm text-ink-soft">{w.note}</p>}
                <ol className="divide-y divide-line border-t border-line">{w.sessions.map((s) => <SessionRow key={s.id} s={s} />)}</ol>
              </details>
            ))}
          </section>
        );
      })}

      <details className="rounded-xl border border-line bg-surface">
        <summary className="min-h-12 cursor-pointer px-4 py-3 font-semibold">Recommencer un nouveau programme</summary>
        <div className="border-t border-line p-1">
          <RunProgramForm current={{ vmaKmh: p.vma.vmaKmh, label: p.vma.label, estimated: false }} replacing />
        </div>
      </details>
    </div>
  );
}
