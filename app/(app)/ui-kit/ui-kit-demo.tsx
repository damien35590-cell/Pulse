"use client";
import { useState } from "react";
import { Dumbbell, Ellipsis, HeartPulse, RefreshCw, Sparkles, Target, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { fmtClock, fmtNum } from "@/lib/format";
import { setTheme } from "@/lib/theme";
import { HR_MAX, fitness, goal, hrBands, liftSession, recent, rideWeather, routeSuggestion, runs, today, week, workout } from "@/lib/mock/ui-kit";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { Delta, Metric } from "@/components/ui/metric";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { TodayCard } from "@/components/dashboard/today-card";
import { WeekCard } from "@/components/dashboard/week-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ActivitySummary } from "@/components/dashboard/activity-summary";
import { TraceChart } from "@/components/activity/trace-chart";
import { ZoneBar } from "@/components/activity/zone-bar";
import { Splits } from "@/components/activity/splits";
import { SetLogger } from "@/components/workout/set-logger";
import { RouteCard } from "@/components/routes/route-card";
import { WeatherBanner, WeatherCredit } from "@/components/routes/weather";

export type Screen = "home" | "list" | "run" | "lift" | "workout" | "tokens";
type Go = (s: Screen, runId?: string) => void;

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const km2 = (v: number) => v.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QUARTERS = [0, 0.25, 0.5, 0.75, 1];

/**
 * Démo du kit UI avec données fictives. Dans l'app : page /ui-kit (sélecteur flottant en bas).
 * `screen` + `onScreen` : mode piloté (préview hors app, où la barre du bas change d'écran).
 */
export function UiKitDemo({ screen: controlled, onScreen }: { screen?: Screen; onScreen?: (s: Screen) => void }) {
  const [local, setLocal] = useState<Screen>("home");
  const [runId, setRunId] = useState(runs[0].id);
  const screen = controlled ?? local;
  const go: Go = (s, id) => {
    if (id) setRunId(id);
    (onScreen ?? setLocal)(s);
    window.scrollTo({ top: 0 });
  };
  const run = runs.find((r) => r.id === runId) ?? runs[0];

  return (
    <div className={cn(!controlled && "pb-16")}>
      {screen === "home" && <Home go={go} />}
      {screen === "list" && <List go={go} />}
      {screen === "run" && <RunDetail run={run} back={() => go("list")} />}
      {screen === "lift" && <LiftDetail back={() => go("list")} />}
      {screen === "tokens" && <Tokens />}
      {screen === "workout" && (
        <SetLogger title={workout.title} program={workout.program} exercises={workout.exercises} startedAt={Date.now() - workout.startedMinAgo * 60000} onExit={() => go("home")} />
      )}
      {!controlled && screen !== "workout" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(theme(spacing.nav)_+_0.75rem)] z-30 flex justify-center px-6">
          <Segmented
            size="sm"
            className="pointer-events-auto w-full max-w-sm bg-surface-3/90 shadow-pop backdrop-blur-xl"
            options={[{ value: "home", label: "Accueil" }, { value: "run", label: "Activité" }, { value: "workout", label: "Séance" }, { value: "tokens", label: "Tokens" }]}
            value={screen === "list" || screen === "lift" ? "run" : screen}
            onChange={(s) => go(s)}
          />
        </div>
      )}
    </div>
  );
}

/* ─────────────── Accueil épuré : 5 blocs au lieu de 11 ─────────────── */
function Home({ go }: { go: Go }) {
  return (
    <>
      <TopBar
        title="dimanche 18 octobre"
        subtitle={`Données fictives · semaine 42 · ${week.done} séances sur ${week.planned}`}
        actions={<button type="button" aria-label="Synchroniser" className={ui.iconBtn}><RefreshCw className="size-5" aria-hidden /></button>}
      />
      <div className="space-y-8">
        <TodayCard {...today} onStart={() => go("workout")} />
        <Section title="Cette semaine" action={<span className="font-num text-sm tabular-nums text-ink-mute">{week.range}</span>}>
          <WeekCard {...week} />
        </Section>
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={HeartPulse} label="Forme" value={String(fitness.ctl)} delta={{ text: signed(fitness.ctlDelta), good: true }} spark={fitness.trend} sub={`Fraîcheur ${signed(fitness.tsb)} · optimal`} />
          <StatTile icon={Target} label={`Objectif ${goal.title}`} value={goal.predicted} unit="prédit" progress={goal.progress} sub={`Cible ${goal.target} · dans ${goal.weeksLeft} sem.`} />
        </div>
        <Section title="Récent" action={<button type="button" onClick={() => go("list")} className="touch-manipulation text-sm font-semibold text-brand active:opacity-60">Tout voir</button>}>
          <div className="space-y-3">
            {recent.slice(0, 2).map((a) => (
              <ActivitySummary key={a.id} a={a} onSelect={() => (a.type === "WORKOUT" ? go("lift") : go("run", a.id))} />
            ))}
          </div>
        </Section>
        <Section title="Itinéraire proposé">
          <div className="space-y-2">
            <WeatherBanner w={rideWeather} />
            <RouteCard r={routeSuggestion} onSelect={() => undefined} />
            <WeatherCredit className="px-1" />
          </div>
        </Section>
      </div>
    </>
  );
}

/* ─────────────── Liste des activités ─────────────── */
function List({ go }: { go: Go }) {
  const [f, setF] = useState<"all" | "RUN" | "WORKOUT">("all");
  const items = recent.filter((a) => f === "all" || a.type === f);
  return (
    <>
      <TopBar title="Activités" subtitle="Données fictives · octobre · 9 séances" actions={<button type="button" aria-label="Importer un fichier" className={ui.iconBtn}><Upload className="size-5" aria-hidden /></button>} />
      <Segmented
        className="mb-5"
        options={[{ value: "all", label: "Toutes" }, { value: "RUN", label: "Course" }, { value: "WORKOUT", label: "Muscu" }]}
        value={f}
        onChange={setF}
      />
      <div className="space-y-3">
        {items.map((a) => <ActivitySummary key={a.id} a={a} onSelect={() => (a.type === "WORKOUT" ? go("lift") : go("run", a.id))} />)}
      </div>
    </>
  );
}

/* ─────────────── Détail course : résumé d'abord, analyse ensuite ─────────────── */
function RunDetail({ run, back }: { run: (typeof runs)[number]; back: () => void }) {
  return (
    <>
      <TopBar
        title={run.title}
        subtitle={`Course · ${run.when}`}
        back={back}
        backLabel="Activités"
        actions={<button type="button" aria-label="Plus d’options" className={ui.iconBtn}><Ellipsis className="size-5" aria-hidden /></button>}
      />
      <div className="space-y-8">
        <section aria-label="Résumé" className={cn(ui.card, "p-4")}>
          <dl className="flex justify-between gap-3">
            <Metric size="xl" label="Distance" value={km2(run.distanceKm)} unit="km" />
            <Metric size="xl" label="Temps" value={fmtClock(run.movingS)} />
            <Metric size="xl" label="Allure" value={run.pace} unit="/km" />
          </dl>
          <div className="my-4 h-px bg-line/70" />
          <dl className="grid grid-cols-3 gap-x-3 gap-y-4">
            <Metric label="FC moy." value={run.avgHr} unit="bpm" />
            <Metric label="FC max" value={run.maxHr} unit="bpm" />
            <Metric label="Dénivelé" value={run.gain} unit="m D+" />
            <Metric label="Cadence" value={run.cadence} unit="pas/min" />
            <Metric label="Calories" value={run.kcal} unit="kcal" />
            <Metric label="Effort" value={run.rpe} unit="/ 10" />
          </dl>
        </section>

        {run.insight && (
          <p className={cn(ui.card, "flex gap-3 p-4 text-[15px] leading-snug text-ink")}>
            <Sparkles className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
            {run.insight}
          </p>
        )}

        <Section title="Fréquence cardiaque" action={<span className="text-xs text-ink-mute">Glisse le doigt sur la courbe</span>}>
          <div className={cn(ui.card, "p-4")}>
            <TraceChart
              values={run.hr}
              unit="bpm"
              label="Fréquence cardiaque"
              color="text-z5"
              bands={hrBands}
              area={false}
              ticks={QUARTERS.map((q) => `${Math.round((q * run.movingS) / 60)}'`)}
              at={(f) => fmtClock(f * run.movingS)}
            />
          </div>
        </Section>

        <Section title="Temps par zone" action={<span className="font-num text-sm tabular-nums text-ink-mute">FC max {HR_MAX}</span>}>
          <div className={cn(ui.card, "p-4")}>
            <ZoneBar zones={run.zones} />
          </div>
        </Section>

        <Section title="Allure par km">
          <div className={cn(ui.card, "px-3 py-4")}>
            <Splits splits={run.splits} />
          </div>
        </Section>

        <Section title="Altitude" action={<span className="font-num text-sm tabular-nums text-ink-mute">{run.gain} m D+</span>}>
          <div className={cn(ui.card, "p-4")}>
            <TraceChart
              values={run.ele}
              unit="m"
              label="Altitude"
              color="text-ink-soft"
              height={96}
              ticks={QUARTERS.map((q, i) => `${fmtNum(q * run.distanceKm, 1)}${i === 4 ? " km" : ""}`)}
              at={(f) => `km ${fmtNum(f * run.distanceKm, 1)}`}
            />
          </div>
        </Section>
      </div>
    </>
  );
}

/* ─────────────── Détail muscu : la séance se relit exercice par exercice ─────────────── */
function LiftDetail({ back }: { back: () => void }) {
  const s = liftSession;
  return (
    <>
      <TopBar title={s.title} subtitle={`Musculation · ${s.when}`} back={back} backLabel="Activités" />
      <div className="space-y-8">
        <section aria-label="Résumé" className={cn(ui.card, "p-4")}>
          <dl className="grid grid-cols-3 gap-3">
            <Metric size="xl" label="Durée" value={s.durationMin} unit="min" />
            <Metric size="xl" label="Séries" value={s.sets} />
            <Metric size="xl" label="Volume" value={fmtNum(s.volumeKg / 1000, 1)} unit="t" />
          </dl>
        </section>
        <Section title="Exercices">
          <div className="space-y-3">
            {s.exercises.map((e) => {
              const scores = e.sets.map((x) => x.kg * x.reps), best = scores.indexOf(Math.max(...scores)); // première meilleure série
              return (
                <div key={e.name} className={cn(ui.card, "p-4")}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 text-[15px] font-semibold">
                      <Dumbbell className="size-4 text-ink-mute" aria-hidden />
                      {e.name}
                    </p>
                    {e.delta && <Delta good>{e.delta}</Delta>}
                  </div>
                  <ol className="mt-3 flex flex-wrap gap-1.5">
                    {e.sets.map((x, i) => (
                      <li
                        key={i}
                        className={cn(
                          "rounded-lg px-2 py-1 font-num text-[15px] font-medium tabular-nums",
                          i === best && scores[best] > 0 ? "bg-brand/15 text-brand" : "bg-surface-2 text-ink",
                        )}
                      >
                        {e.bodyweight ? (x.kg ? `+${fmtNum(x.kg, 1)}` : "PDC") : fmtNum(x.kg, 1)} × {x.reps}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </>
  );
}

/* ─────────────── Tokens : la référence visuelle du système ─────────────── */
function Tokens() {
  const [theme, setThemeState] = useState<"dark" | "light">(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark",
  );
  const [sw, setSw] = useState({ a: true, b: false });
  const swatch = (name: string, cls: string, note?: string) => (
    <div key={name} className="min-w-0">
      <div className={cn("h-14 rounded-tile ring-1 ring-inset ring-white/5", cls)} />
      <p className="mt-1.5 truncate text-xs font-medium text-ink">{name}</p>
      {note && <p className="truncate font-num text-xs tabular-nums text-ink-mute">{note}</p>}
    </div>
  );
  return (
    <>
      <TopBar title="Système de design" subtitle="Les tokens partagés par tous les écrans" />
      <Segmented
        className="mb-6"
        options={[{ value: "dark", label: "Thème sombre" }, { value: "light", label: "Thème clair" }]}
        value={theme}
        onChange={(t) => {
          setThemeState(t);
          setTheme(t);
        }}
      />
      <div className="space-y-8">
        <Section title="Surfaces · élévation par la lumière">
          <div className="grid grid-cols-4 gap-2">
            {swatch("bg", "bg-bg", "#0A0A0C")}
            {swatch("surface", "bg-surface", "#141417")}
            {swatch("surface-2", "bg-surface-2", "#1E1E22")}
            {swatch("surface-3", "bg-surface-3", "#2A2A30")}
          </div>
        </Section>

        <Section title="Texte · contraste sur carte">
          <div className={cn(ui.card, "divide-y divide-line/60 px-4")}>
            {[
              ["text-ink", "Valeurs, titres", "16,9:1"],
              ["text-ink-soft", "Unités, phrases", "7,2:1"],
              ["text-ink-mute", "Libellés, dates", "5,4:1"],
              ["text-brand", "Liens, mises en avant", "5,4:1"],
            ].map(([c, use, ratio]) => (
              <p key={c} className="flex h-12 items-center justify-between gap-3">
                <span className={cn("font-semibold", c)}>{use}</span>
                <span className="font-num text-sm tabular-nums text-ink-mute">{c.replace("text-", "")} · {ratio}</span>
              </p>
            ))}
          </div>
        </Section>

        <Section title="Accent et états">
          <div className="grid grid-cols-4 gap-2">
            {swatch("brand", "bg-brand", "#FC4C02")}
            {swatch("good", "bg-good", "progrès")}
            {swatch("warn", "bg-warn", "vigilance")}
            {swatch("bad", "bg-bad", "baisse")}
          </div>
        </Section>

        <Section title="Zones d'intensité">
          <div className="flex gap-1.5">
            {(["bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5", "bg-z6"] as const).map((c, i) => (
              <span key={c} className={cn("grid h-10 flex-1 place-items-center rounded-lg font-num text-sm font-bold text-black/80", c)}>Z{i + 1}</span>
            ))}
          </div>
        </Section>

        <Section title="Chiffres · Barlow Semi Condensed">
          <div className={cn(ui.card, "space-y-4 p-4")}>
            <dl className="grid grid-cols-2 gap-4">
              <Metric size="hero" label="metric-hero · 56" value="47:18" />
              <Metric size="xl" label="metric-xl · 40" value="4:43" unit="/km" />
              <Metric size="lg" label="metric-lg · 28" value="10,02" unit="km" />
              <Metric size="md" label="metric-md · 22" value="162" unit="bpm" />
            </dl>
            <div className="grid grid-cols-2 gap-3 border-t border-line/60 pt-4">
              <div>
                <p className={ui.label}>Inter, 32 px</p>
                <p className="mt-1 font-sans text-[32px] font-semibold tabular-nums leading-none">1:42:36</p>
              </div>
              <div>
                <p className={ui.label}>Barlow SC, 32 px</p>
                <p className="mt-1 font-num text-[32px] font-semibold tabular-nums leading-none">1:42:36</p>
              </div>
            </div>
            <p className="text-xs text-ink-soft">Même taille, environ 20 % plus étroit : à largeur égale, des chiffres plus grands dans une grille à 3 ou 4 colonnes.</p>
          </div>
        </Section>

        <Section title="Rayons et ombres">
          <div className="grid grid-cols-3 gap-3 text-center text-xs text-ink-soft">
            <div><div className="h-16 rounded-tile bg-surface shadow-card" /><p className="mt-1.5">tile · 14</p></div>
            <div><div className="h-16 rounded-card bg-surface shadow-card" /><p className="mt-1.5">card · 20</p></div>
            <div><div className="h-16 rounded-t-sheet bg-surface-2 shadow-pop" /><p className="mt-1.5">sheet · 28</p></div>
          </div>
        </Section>

        <Section title="Interrupteurs · toute la ligne se touche">
          <div className={cn(ui.card, "divide-y divide-line/60 px-4")}>
            <Switch label="Coach du matin" description="Vers 7 h : la séance du jour et le meilleur créneau" checked={sw.a} onChange={(a) => setSw({ ...sw, a })} />
            <Switch label="Bilan du dimanche" checked={sw.b} onChange={(b) => setSw({ ...sw, b })} />
          </div>
        </Section>

        <Section title="Boutons · appuie pour sentir le retour">
          <div className="grid gap-2">
            <button type="button" className={ui.btnPrimary}>Principal</button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={ui.btnSecondary}>Secondaire</button>
              <button type="button" className={ui.btnDanger}>Supprimer</button>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
