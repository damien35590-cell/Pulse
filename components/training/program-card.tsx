import Link from "next/link";
import { ChevronRight, CloudRain, Flashlight, Pause, Rocket, Route, ThermometerSun, type LucideIcon } from "lucide-react";
import type { RunProgramView, SessionView } from "@/lib/data/training";
import { HEAT_FEELS_C } from "@/lib/weather/rules";
import { TIRED_LINE, lateLine, routeHref, type CoachPlan, type SessionCondition } from "@/lib/coach/today";
import { sessionFromProgram } from "@/lib/routes/session-fit";
import { fmtDuration } from "@/lib/format";
import { dayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { LiftActions, PauseToggle, SessionActions, VmaTestPrompt } from "./program-actions";
import { SessionCarousel } from "./session-carousel";

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

/** Séances encore à faire après la prochaine, dans l'ordre du programme (au plus `max`). */
function upcomingAfter(p: RunProgramView, max = 5) {
  if (!p.next) return [];
  const all = p.weeks.flatMap((w) => w.sessions).filter((s) => s.status === "PLANNED" && s.id !== p.next!.id);
  const from = (s: SessionView) => s.weekNumber * 100 + s.orderInWeek;
  const start = from(p.next);
  return all.filter((s) => from(s) > start).sort((a, b) => from(a) - from(b)).slice(0, max);
}

/** Séances déjà faites ou passées de la semaine du programme (diapos à gauche du jour). */
const pastOfWeek = (week: { sessions: SessionView[] } | undefined) =>
  (week?.sessions ?? []).filter((s) => s.status === "COMPLETED" || s.status === "SKIPPED");

/** Séance passée de la semaine (diapo à gauche du jour) : lecture seule, lien vers la sortie si elle existe. */
function PastSlide({ s }: { s: SessionView }) {
  const done = s.status === "COMPLETED";
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-label uppercase text-ink-mute">Séance {s.orderInWeek} · {done ? "faite" : "passée"}</p>
        {s.isKeySession && <KeyBadge />}
      </div>
      <p className={cn("mt-1.5 text-xl font-bold leading-tight tracking-tight", !done && "text-ink-soft")}>{s.title}</p>
      <p className="mt-1 font-num text-sm tabular-nums text-ink-soft">≈ {fmtDuration(s.durationS)}</p>
      {s.summary && <p className="mt-1.5 line-clamp-3 text-sm leading-snug text-ink-soft">{s.summary}</p>}
      {s.activityId && (
        <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-semibold text-brand">Voir la sortie<ChevronRight className="size-4" aria-hidden /></span>
      )}
    </>
  );
  const box = "flex h-full flex-col rounded-tile bg-surface-2/60 p-3";
  return s.activityId
    ? <Link href={`/activities/${s.activityId}`} className={cn(box, "transition duration-150 ease-snappy active:scale-[0.985]")}>{body}</Link>
    : <div className={box}>{body}</div>;
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

const CONDITION: Record<SessionCondition, { icon: LucideIcon; label: string }> = {
  night: { icon: Flashlight, label: "Finit de nuit : prends ta frontale" },
  rain: { icon: CloudRain, label: "Forte pluie prévue" },
  heat: { icon: ThermometerSun, label: `Chaleur : plus de ${HEAT_FEELS_C} °C ressentis` },
};

/** Pastille du jour hors course (« Muscu », « Repos », « Fait »…) : même forme que « Séance clé », en neutre. */
function DayTag({ children }: { children: string }) {
  return <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-soft">{children}</span>;
}

/** Pied du programme hors carrousel : « Bloc 1 · Semaine 2/4 · … », points de la semaine, « 1/3 ». */
function PlanFoot({ p }: { p: RunProgramView }) {
  const week = p.weeks.find((w) => w.number === p.current.number);
  return (
    <div className="relative mt-4 flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-xs text-ink-mute">{blockLabel(p)}</p>
      <div className="flex shrink-0 items-center gap-3">
        {week && <WeekDots sessions={week.sessions} />}
        <p className="font-num text-sm tabular-nums text-ink-soft">{p.weekDone}/{p.sessionsPerWeek}</p>
      </div>
    </div>
  );
}

/**
 * Carte du jour de l'accueil : le conseil du coach et le programme course en UNE carte (style « Prochaine séance », halo Volt en haut à droite).
 * Course du programme à faire : titre, étapes, retard éventuel, Faite / Passer, séances suivantes au doigt, pied du programme.
 * Muscu, repos, séance faite ou footing hors programme : le conseil du coach, puis le pied du programme s'il y en a un.
 * Météo : un seul pictogramme quand les conditions comptent (nuit, forte pluie, chaleur) ; créneau, météo et boucle sont dans « Prépare ta sortie ».
 * `c` null (coach indisponible, compte vide) : la prochaine séance du programme seule. Rien sans coach ni programme.
 */
export function DayCard({ c, p }: { c: CoachPlan | null; p: RunProgramView | null }) {
  if (!c && !p) return null;
  const paused = p?.status === "PAUSED", n = p && !paused ? p.next : null;
  const r = c?.run;
  // Faite / Passer sur la séance du programme : quand c'est elle que le coach propose aujourd'hui (ou sans coach).
  const planRun = n && (!c || c.kind === "run") ? n : null;
  const week = p?.weeks.find((w) => w.number === p.current.number);
  const past0 = p && !paused ? pastOfWeek(week) : [];
  // Séance faite aujourd'hui : la diapo du coach (« Séance du jour faite ») la remplace et porte son point.
  const doneToday = c?.kind === "done" ? past0.filter((s) => s.completedDay === dayKey(new Date(), "Europe/Paris")).at(-1) : undefined;
  const past = doneToday ? past0.filter((s) => s.id !== doneToday.id) : past0;
  // Hors course du programme (muscu, repos, séance faite) : les séances à faire restent accessibles au doigt.
  const upcoming = planRun && p ? upcomingAfter(p) : n && p ? [n, ...upcomingAfter(p, 4)] : [];
  const swipe = !!p && !paused && (planRun ? true : !!c && past.length + upcoming.length > 0);
  const vma = p?.pendingTest ? <div className="relative mt-4"><VmaTestPrompt sessionId={p.pendingTest.sessionId} /></div> : null;
  const cond = r?.condition ? CONDITION[r.condition] : null;
  const label = c ? "Aujourd’hui" : paused ? "Programme en pause" : "Prochaine séance";
  const route = r?.routeHref ?? (n ? routeHref(Math.max(15, Math.round(n.durationS / 60)), sessionFromProgram(n)) : "/itineraires");
  const steps = r?.steps ?? planRun?.summary;
  const notes = r ? [r.tired && TIRED_LINE, r.late > 0 && lateLine(r.late)].filter((l): l is string => !!l) : [];

  return (
    <section aria-label="Séance du jour" className={cn(ui.card, "relative overflow-hidden p-4 pb-0")}>
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-brand/[0.07] blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-label uppercase text-brand">{label}</p>
          {planRun?.isKeySession ? <KeyBadge /> : c && c.kind !== "run" ? <DayTag>{c.tag}</DayTag> : null}
          {cond && (
            <span role="img" aria-label={cond.label} title={cond.label} className="grid size-6 shrink-0 place-items-center rounded-full bg-warn/15 text-warn">
              <cond.icon className="size-3.5" strokeWidth={2.4} aria-hidden />
            </span>
          )}
        </div>
        {(p || c?.kind === "lift") && (
          <Link href={c?.kind === "lift" ? "/plan#muscu" : "/plan"} className="-my-3 inline-flex h-12 shrink-0 items-center text-sm font-semibold text-brand active:opacity-60">Programme</Link>
        )}
      </div>

      {planRun && p ? (
        <SessionCarousel
          className="relative mt-1.5"
          slideIds={[...past.map((s) => s.id), planRun.id, ...upcoming.map((s) => s.id)]}
          start={past.length}
          week={(week?.sessions ?? []).map((s) => ({ id: s.id, title: s.title, status: s.status }))}
          between={vma}
          footer={<p className="truncate text-xs text-ink-mute">{blockLabel(p)}</p>}
          count={`${p.weekDone}/${p.sessionsPerWeek}`}
        >
          {past.map((s) => <PastSlide key={s.id} s={s} />)}
          <div>
            <h2 className="text-balance text-[28px] font-bold leading-tight tracking-tight">{planRun.title}</h2>
            {steps && <p className="mt-2 text-[15px] leading-snug text-ink-soft">{steps}</p>}
            {notes.map((l) => <p key={l} className="mt-1.5 text-[15px] leading-snug text-ink-soft">{l}</p>)}
            <div className="mt-5"><SessionActions id={planRun.id} variant="card" /></div>
          </div>
          {upcoming.map((s) => <UpcomingSlide key={s.id} s={s} current={p.current.number} />)}
        </SessionCarousel>
      ) : swipe && c && p ? (
        <SessionCarousel
          className="relative mt-1.5"
          slideIds={[...past.map((s) => s.id), doneToday?.id ?? "today", ...upcoming.map((s) => s.id)]}
          start={past.length}
          week={(week?.sessions ?? []).map((s) => ({ id: s.id, title: s.title, status: s.status }))}
          between={vma}
          footer={<p className="truncate text-xs text-ink-mute">{blockLabel(p)}</p>}
          count={`${p.weekDone}/${p.sessionsPerWeek}`}
        >
          {past.map((s) => <PastSlide key={s.id} s={s} />)}
          <CoachBody c={c} />
          {upcoming.map((s) => <UpcomingSlide key={s.id} s={s} current={p.current.number} />)}
        </SessionCarousel>
      ) : (
        <>
          {c ? <CoachBody c={c} className="relative mt-1.5" /> : !paused && !n && <p className="relative mt-2 text-[15px] text-ink-soft">Programme terminé, bravo.</p>}
          {paused && p && (
            <div className="relative mt-4 space-y-3">
              <p className="flex items-center gap-2 text-[15px] text-ink-soft"><Pause className="size-4 shrink-0" aria-hidden />{c ? "Programme en pause : il t’attend, reprends quand tu veux." : "Il t’attend, reprends quand tu veux."}</p>
              <PauseToggle id={p.id} paused full />
            </div>
          )}
          {vma}
          {p && <PlanFoot p={p} />}
        </>
      )}

      <Link href={route} className="relative -mx-4 mt-4 flex min-h-12 touch-manipulation items-center gap-3 border-t border-line px-4 py-3 transition duration-150 ease-snappy active:bg-surface-2">
        <Route className="size-5 shrink-0 text-ink-soft" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">Prépare ta sortie</span>
        <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
      </Link>
    </section>
  );
}

/** Conseil du coach hors course du programme : titre, lignes, actions muscu, « Demain : … ». */
function CoachBody({ c, className }: { c: CoachPlan; className?: string }) {
  return (
    <div className={className}>
      <h2 className="text-balance text-[28px] font-bold leading-tight tracking-tight">{c.title}</h2>
      <ul className="mt-2 space-y-1.5">
        {(c.run ? [c.run.steps] : c.lines).map((l) => <li key={l} className="text-[15px] leading-snug text-ink-soft">{l}</li>)}
      </ul>
      {c.kind === "lift" && <LiftActions />}
      {c.next && <p className="mt-3 text-sm text-ink-mute">{c.next}</p>}
    </div>
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
