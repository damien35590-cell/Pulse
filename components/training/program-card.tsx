import Link from "next/link";
import { ChevronRight, CloudRain, Flashlight, Pause, Rocket, Route, ThermometerSun, type LucideIcon } from "lucide-react";
import type { RunProgramView, SessionView } from "@/lib/data/training";
import { HEAT_FEELS_C } from "@/lib/weather/rules";
import { TIRED_LINE, lateLine, routeHref, type CoachPlan, type SessionCondition } from "@/lib/coach/today";
import { sessionFromProgram } from "@/lib/routes/session-fit";
import { fmtDuration } from "@/lib/format";
import type { ReactNode } from "react";
import { dayKey, shiftDay } from "@/lib/dates";
import type { LiftSlide, LiftWeek } from "@/lib/data/lift-week";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { LiftActions, PauseToggle, SessionActions, VmaTestPrompt } from "./program-actions";
import { SessionCarousel, type DotGroup, type WeekDot } from "./session-carousel";

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

const TZ = "Europe/Paris";
const WEEKDAY = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "UTC" });
/** « Hier », « Demain », « Samedi », « Semaine prochaine » : jour d'une diapo, vu d'aujourd'hui. */
function dayLabel(day: string, today: string) {
  const d = Math.round((Date.parse(day) - Date.parse(today)) / 864e5);
  if (d === 0) return "Aujourd’hui";
  if (d === -1) return "Hier";
  if (d === 1) return "Demain";
  const monday = shiftDay(today, -((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
  if (day >= shiftDay(monday, 7)) return day < shiftDay(monday, 14) ? "Semaine prochaine" : "Plus tard";
  const w = WEEKDAY.format(new Date(`${day}T12:00:00Z`));
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** En-tête d'une diapo : « Mardi · fait », pastille Running / Muscu, badge éventuel. */
function SlideHead({ when, sport, children }: { when: string; sport: "Running" | "Muscu"; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <p className="min-w-0 truncate text-label uppercase text-ink-mute">{when}</p>
      <DayTag>{sport}</DayTag>
      {children}
    </div>
  );
}

const SLIDE = "flex h-full flex-col rounded-tile bg-surface-2/60 p-3";

/** Séance course passée de la semaine : lecture seule, lien vers la sortie si elle existe. */
function PastSlide({ s, when }: { s: SessionView; when: string }) {
  const done = s.status === "COMPLETED";
  const body = (
    <>
      <SlideHead when={`${when} · ${done ? "fait" : "passée"}`} sport="Running">{s.isKeySession && <KeyBadge />}</SlideHead>
      <p className={cn("mt-1.5 text-xl font-bold leading-tight tracking-tight", !done && "text-ink-soft")}>{s.title}</p>
      <p className="mt-1 font-num text-sm tabular-nums text-ink-soft">≈ {fmtDuration(s.durationS)}</p>
      {s.summary && <p className="mt-1.5 line-clamp-3 text-sm leading-snug text-ink-soft">{s.summary}</p>}
      {s.activityId && (
        <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-semibold text-brand">Voir la sortie<ChevronRight className="size-4" aria-hidden /></span>
      )}
    </>
  );
  return s.activityId
    ? <Link href={`/activities/${s.activityId}`} className={cn(SLIDE, "transition duration-150 ease-snappy active:scale-[0.985]")}>{body}</Link>
    : <div className={SLIDE}>{body}</div>;
}

/** « +3 répétitions par rapport à la précédente » : le critère de progrès Lafay (total de l'exercice, ici de la séance). */
const deltaLine = (d: number, kind: string) =>
  d === 0 ? `Même total que la séance ${kind} précédente` : `${d > 0 ? "+" : "−"}${Math.abs(d)} répétition${Math.abs(d) > 1 ? "s" : ""} par rapport à la séance ${kind} précédente`;

/** Séance de muscu de la semaine : faite (total, progrès, lien) ou à venir (exercices et cibles de la rotation). */
function LiftSlideView({ l, when }: { l: LiftSlide; when: string }) {
  if (l.state === "done") {
    const kind = l.kind === "HAUT" ? "haut" : l.kind === "BAS" ? "bas" : "";
    return (
      <Link href={`/activities/${l.id}`} className={cn(SLIDE, "transition duration-150 ease-snappy active:scale-[0.985]")}>
        <SlideHead when={`${when} · fait`} sport="Muscu" />
        <p className="mt-1.5 text-xl font-bold leading-tight tracking-tight">{l.title}</p>
        <p className="mt-1 font-num text-sm tabular-nums text-ink-soft">{l.exercises} exercice{l.exercises > 1 ? "s" : ""} · {l.totalReps} répétitions</p>
        {l.delta != null && <p className={cn("mt-1.5 text-sm leading-snug", l.delta > 0 ? "text-good" : "text-ink-soft")}>{deltaLine(l.delta, kind)}</p>}
        <span className="mt-auto flex items-center gap-1 pt-3 text-sm font-semibold text-brand">Voir la séance<ChevronRight className="size-4" aria-hidden /></span>
      </Link>
    );
  }
  return (
    <div className={SLIDE}>
      <SlideHead when={when} sport="Muscu" />
      <p className="mt-1.5 text-xl font-bold leading-tight tracking-tight">{l.title}</p>
      {l.items.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {l.items.map((e) => (
            <li key={e.code + e.name} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-soft">
              <b className="mr-1 font-semibold text-ink">{e.code}</b>{e.name} <span className="font-num tabular-nums">{e.target}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-auto pt-3 text-xs text-ink-mute">Rotation : {l.kind === "HAUT" ? "le haut après le bas" : "le bas après le haut"}</p>
    </div>
  );
}

/** Séance course à venir : lecture seule, les actions restent sur celle du jour. */
function UpcomingSlide({ s, when }: { s: SessionView; when: string }) {
  return (
    <div className={SLIDE}>
      <SlideHead when={when} sport="Running">{s.isKeySession && <KeyBadge />}</SlideHead>
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
 * Carte du jour de l'accueil, devenue « Ta semaine » quand un programme course tourne : course et muscu dans un même carrousel,
 * dans l'ordre des jours. Ce qui est fait à gauche, aujourd'hui (le conseil du coach, ou la séance du programme avec Faite / Passer),
 * ce qui vient à droite : séances du programme course et muscu en rotation haut / bas (lib/coach/week-plan.ts).
 * Deux rangées de pastilles (Running, Muscu) suivent la diapo affichée.
 * Météo : un seul pictogramme quand les conditions comptent (nuit, forte pluie, chaleur) ; créneau, météo et boucle sont dans « Prépare ta sortie ».
 * Sans programme actif (ou en pause) : le conseil du coach seul, comme avant. `c` null : la prochaine séance du programme. Rien sans coach ni programme.
 */
export function DayCard({ c, p, lw }: { c: CoachPlan | null; p: RunProgramView | null; lw?: LiftWeek | null }) {
  if (!c && !p) return null;
  const paused = p?.status === "PAUSED", n = p && !paused ? p.next : null;
  const r = c?.run;
  // Faite / Passer sur la séance du programme : quand c'est elle que le coach propose aujourd'hui (ou sans coach).
  const planRun = n && (!c || c.kind === "run") ? n : null;
  const week = p?.weeks.find((w) => w.number === p.current.number);
  const vma = p?.pendingTest ? <div className="relative mt-4"><VmaTestPrompt sessionId={p.pendingTest.sessionId} /></div> : null;
  const cond = r?.condition ? CONDITION[r.condition] : null;
  const route = r?.routeHref ?? (n ? routeHref(Math.max(15, Math.round(n.durationS / 60)), sessionFromProgram(n)) : "/itineraires");
  const steps = r?.steps ?? planRun?.summary;
  const notes = r ? [r.tired && TIRED_LINE, r.late > 0 && lateLine(r.late)].filter((l): l is string => !!l) : [];
  const swipe = !!p && !paused && (!!planRun || !!c);

  const badges = (
    <>
      {planRun?.isKeySession ? <KeyBadge /> : c && c.kind !== "run" ? <DayTag>{c.tag}</DayTag> : null}
      {cond && (
        <span role="img" aria-label={cond.label} title={cond.label} className="grid size-6 shrink-0 place-items-center rounded-full bg-warn/15 text-warn">
          <cond.icon className="size-3.5" strokeWidth={2.4} aria-hidden />
        </span>
      )}
    </>
  );
  const programLink = (p || c?.kind === "lift") && (
    <Link href={c?.kind === "lift" ? "/plan#muscu" : "/plan"} className="-my-3 inline-flex h-12 shrink-0 items-center text-sm font-semibold text-brand active:opacity-60">Programme</Link>
  );
  const prepare = (
    <Link href={route} className="relative -mx-4 mt-4 flex min-h-12 touch-manipulation items-center gap-3 border-t border-line px-4 py-3 transition duration-150 ease-snappy active:bg-surface-2">
      <Route className="size-5 shrink-0 text-ink-soft" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink">Prépare ta sortie</span>
      <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
    </Link>
  );

  if (swipe && p) {
    const today = dayKey(new Date(), TZ), tomorrow = shiftDay(today, 1);
    const past = pastOfWeek(week);
    // Séance course faite aujourd'hui : la diapo du jour la remplace et porte sa pastille. Si plusieurs sont cochées aujourd'hui,
    // celle qui porte la sortie du jour l'emporte (une coche à la main peut dater d'aujourd'hui).
    const todays = c?.kind === "done" ? past.filter((s) => s.completedDay === today) : [];
    const doneToday = todays.find((s) => s.activityId) ?? todays.at(-1);
    const upcoming = planRun ? upcomingAfter(p) : n ? [n, ...upcomingAfter(p, 4)] : [];
    // Muscu du jour (faite, ou proposée par le coach) : elle aussi portée par la diapo du jour.
    const liftToday = (lw?.slides ?? []).filter((l) => l.day === today && (l.state === "done" ? c?.kind === "done" : c?.kind === "lift"));

    type Item = { day: string; rank: number; dots: string[]; node: ReactNode };
    const items: Item[] = [
      ...past.filter((s) => s !== doneToday).map((s) => {
        const day = s.completedDay ?? s.date;
        return { day, rank: 0, dots: [s.id], node: <PastSlide key={s.id} s={s} when={dayLabel(day, today)} /> };
      }),
      ...upcoming.map((s) => {
        const day = s.date < tomorrow ? tomorrow : s.date;
        return { day, rank: 2, dots: [s.id], node: <UpcomingSlide key={s.id} s={s} when={dayLabel(day, today)} /> };
      }),
      ...(lw?.slides ?? []).filter((l) => !liftToday.includes(l)).map((l) => ({
        day: l.day, rank: l.state === "done" ? 0.5 : 2.5, dots: [l.id], node: <LiftSlideView key={l.id} l={l} when={l.state === "planned" && l.nextWeek ? "Semaine prochaine" : dayLabel(l.day, today)} />,
      })),
      {
        day: today, rank: 1, dots: [planRun?.id, doneToday?.id, ...liftToday.map((l) => l.id)].filter((id): id is string => !!id),
        node: (
          <div key="today">
            <div className="flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate text-label uppercase text-brand">Aujourd’hui</p>
              {badges}
            </div>
            {planRun ? (
              <div className="mt-1.5">
                <h2 className="text-balance text-[28px] font-bold leading-tight tracking-tight">{planRun.title}</h2>
                {steps && <p className="mt-2 text-[15px] leading-snug text-ink-soft">{steps}</p>}
                {notes.map((l) => <p key={l} className="mt-1.5 text-[15px] leading-snug text-ink-soft">{l}</p>)}
                <div className="mt-5"><SessionActions id={planRun.id} variant="card" /></div>
              </div>
            ) : c && <CoachBody c={c} className="mt-1.5" />}
          </div>
        ),
      },
    ];
    // Le carrousel s'arrête à la fin de la semaine prochaine : au-delà, la page Programme.
    const nextMonday = shiftDay(today, 7 - ((new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7));
    const shown = items.filter((i) => i.day < shiftDay(nextMonday, 7));
    shown.sort((x, y) => (x.day < y.day ? -1 : x.day > y.day ? 1 : x.rank - y.rank));
    const start = shown.findIndex((i) => i.rank === 1);

    // Pastilles de la semaine de la diapo affichée : cette semaine, ou la suivante dès qu'on y glisse (toujours une pastille entourée).
    const runDots = (sessions: SessionView[]): WeekDot[] => [...sessions]
      // Dans l'ordre des jours, comme les diapos (on ne fait pas toujours les séances dans l'ordre du programme).
      .map((s) => ({ s, day: s.status === "COMPLETED" ? (s.completedDay ?? s.date) : s.id === planRun?.id ? today : s.date < tomorrow && s.status === "PLANNED" ? tomorrow : s.date }))
      .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.s.orderInWeek - b.s.orderInWeek))
      .map(({ s }) => ({ id: s.id, title: s.title, state: s.status === "COMPLETED" ? "done" : s.status === "SKIPPED" ? "skipped" : "todo" }));
    const liftDots = (list: LiftSlide[], target: number, key: string): WeekDot[] => {
      const dots: WeekDot[] = list.map((l) => ({ id: l.id, title: l.title, state: l.state === "done" ? "done" : "todo" }));
      // Cible pas encore couverte (plus de jour valable) : pastilles vides, sans diapo.
      for (let k = dots.length; k < target; k++) dots.push({ id: `lift-free-${key}-${k}`, title: "Séance de muscu", state: "todo" });
      return dots;
    };
    const nextWeek = p.weeks.find((w) => w.number === p.current.number + 1);
    const groups: DotGroup[] = [
      {
        rows: [
          { label: "Running", tone: "run", count: `${p.weekDone}/${p.sessionsPerWeek}`, dots: runDots(week?.sessions ?? []) },
          ...(lw ? [{ label: "Muscu", tone: "lift" as const, count: `${lw.done}/${lw.target}`, dots: liftDots(lw.slides.filter((l) => !(l.state === "planned" && l.nextWeek)), lw.target, "now") }] : []),
        ],
        footer: <p className="truncate text-xs text-ink-mute">{blockLabel(p)}</p>,
      },
      {
        title: "Semaine prochaine",
        rows: [
          { label: "Running", tone: "run", count: `0/${p.sessionsPerWeek}`, dots: runDots(nextWeek?.sessions ?? []) },
          ...(lw ? [{ label: "Muscu", tone: "lift" as const, count: `0/${lw.target}`, dots: liftDots(lw.slides.filter((l) => l.state === "planned" && l.nextWeek), lw.target, "next") }] : []),
        ],
        footer: nextWeek && (
          <p className="truncate text-xs text-ink-mute">
            Bloc {nextWeek.block} · Semaine {nextWeek.weekInBlock}/{p.blockWeeks} · {p.name}{nextWeek.isRecovery ? " · allégée" : ""}
          </p>
        ),
      },
    ];

    return (
      <section aria-label="Ta semaine" className={cn(ui.card, "relative overflow-hidden p-4 pb-0")}>
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-brand/[0.07] blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-label uppercase text-brand">Ta semaine</p>
          {programLink}
        </div>
        <SessionCarousel
          className="relative mt-1.5"
          slideDots={shown.map((i) => i.dots)}
          slideGroup={shown.map((i) => (i.day >= nextMonday ? 1 : 0))}
          start={Math.max(0, start)}
          groups={groups}
          between={vma}
        >
          {shown.map((i) => i.node)}
        </SessionCarousel>
        {prepare}
      </section>
    );
  }

  const label = c ? "Aujourd’hui" : paused ? "Programme en pause" : "Prochaine séance";
  return (
    <section aria-label="Séance du jour" className={cn(ui.card, "relative overflow-hidden p-4 pb-0")}>
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 size-56 rounded-full bg-brand/[0.07] blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 truncate text-label uppercase text-brand">{label}</p>
          {badges}
        </div>
        {programLink}
      </div>
      {c ? <CoachBody c={c} className="relative mt-1.5" /> : !paused && !n && <p className="relative mt-2 text-[15px] text-ink-soft">Programme terminé, bravo.</p>}
      {paused && p && (
        <div className="relative mt-4 space-y-3">
          <p className="flex items-center gap-2 text-[15px] text-ink-soft"><Pause className="size-4 shrink-0" aria-hidden />{c ? "Programme en pause : il t’attend, reprends quand tu veux." : "Il t’attend, reprends quand tu veux."}</p>
          <PauseToggle id={p.id} paused full />
        </div>
      )}
      {vma}
      {p && <PlanFoot p={p} />}
      {prepare}
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
