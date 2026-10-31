import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayKey, shiftDay, weekKeys } from "@/lib/dates";
import { fillMissingDates, groupByWeek } from "@/lib/fill-dates";
import { climbCompare } from "@/lib/insights/landmarks";
import { SPORTS, MY_SPORTS } from "@/lib/sports";
import { activityStyle } from "@/lib/activity-style";
import { isVirtual } from "@/lib/art/card";
import { getStrengthProgram } from "@/lib/data/strength-program";
import { isCommute } from "@/lib/routes/estimate";
import { fmtDuration, fmtNum } from "@/lib/format";
import { BUILT_IN } from "@/lib/workout/builtin";
import { catalogExercise, catalogFor, ladderInfo } from "@/lib/workout/catalog";
import { FITNESS_HISTORY_DAYS, formSeries, zone as formZone } from "@/lib/fitness";
import { getAdvanced } from "@/lib/data/advanced";
import { getStrengthAnalysis } from "@/lib/analytics/strength";
import { getCyclingAnalysis } from "@/lib/analytics/cycling";
import { getHikingAnalysis } from "@/lib/analytics/hiking";
import { parsePeriod, periodParams, weeksLabel } from "@/lib/analysis/period";
import { MAX_NOTES, exceptionalPrevious, overviewNotes, frame, rankNotes, rateChange, runNotes, sessionsPerWeek, strengthNotes, timeChange, type CoachNote } from "@/lib/analytics/coach-notes";
import { getPlanAdherence, getRunGoal } from "@/lib/data/coach";
import { lastDebrief } from "@/lib/coach/store";
import { MuscleVolume } from "@/components/body/muscle-volume";
import { TopBar } from "@/components/layout/top-bar";
import { PeriodPicker } from "@/components/analysis/period-picker";
import { CoachCard } from "@/components/analysis/coach-card";
import { EvolutionCard } from "@/components/analysis/evolution-card";
import { ProfileCard } from "@/components/analysis/profile-card";
import { RegularityCard, type DayCell } from "@/components/analysis/regularity-card";
import { Delta, Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analyse" };
const TZ = "Europe/Paris";
const CALENDAR_WEEKS = 26;
/** Courbes de la progression muscu : les 6 exercices du programme Haut / Bas tiennent tous. */
const MAX_LADDERS = 6;
// Exercice du catalogue (code Lafay ou fiche SuperPhysique) ; un exercice saisi librement n'a pas de courbe de progression (il reste dans l'historique et les comptes)
const inCatalogue = (key: string, name: string) => key.startsWith("lafay:") || !!catalogFor(name, null);
const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const dow = (k: string) => (new Date(k + "T00:00:00Z").getUTCDay() + 6) % 7;
type Sp = { w?: string; to?: string; s?: string };
const sum = <T,>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0);
/** Vélo d'intérieur (MyWhoosh, sortie virtuelle, ou sans trace GPS : même règle que l'import) : « Home trainer » dans la répartition. */
const isTrainer = (a: { type: string; source: string; title: string; startLat: number | null }) => a.type === "RIDE" && (isVirtual(a) || a.startLat == null);

/**
 * Analyse, dans cet ordre et rien d'autre par défaut : Coach (2 commentaires, coach IA et question en actions secondaires)
 * → Évolution (3 chiffres clés au-dessus du graphique) → Par sport → « Plus de détails » replié (profil, à retenir, régularité, muscles).
 * Même page pour tous les filtres ; chaque bloc s'adapte au sport. Activités douces (vélotaf, Google Fit, marche) exclues de tous les calculs.
 */
export default async function AnalysisPage({ searchParams }: { searchParams: Sp }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const uid = session.user.id;
  // Période choisie : `now` = fin de la période (aujourd'hui, ou le dimanche de la semaine choisie)
  const period = parsePeriod(searchParams, TZ), now = period.now, W = period.weeks, todayKey = dayKey(new Date(), TZ);
  const coachPeriod = { weeks: W, tz: TZ, now, current: period.current };
  const acts = (await prisma.activity.findMany({
    where: { userId: uid, startedAt: { gte: new Date(+now - Math.max((Math.max(2 * W, CALENDAR_WEEKS) * 7 + 14), FITNESS_HISTORY_DAYS) * 864e5), lte: now } }, orderBy: { startedAt: "asc" },
    select: { id: true, type: true, title: true, source: true, dedupeKey: true, load: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, startLat: true },
  })).filter((a) => !isCommute(a)); // activités douces : hors de toutes les statistiques

  const mon = weekKeys(now, TZ)[0], today = dayKey(now, TZ);
  const ago = (d: Date) => { const diff = (Date.parse(mon) - Date.parse(dayKey(d, TZ))) / 864e5; return diff <= 0 ? 0 : Math.ceil(diff / 7); };
  // Filtres de sport : seulement ceux qui ont au moins une activité (non douce) sur la période ; « Tous » toujours. Un filtre disparu retombe sur « Tous ».
  const inPeriod = acts.filter((a) => ago(a.startedAt) < W);
  const sports = MY_SPORTS.filter((k) => inPeriod.some((a) => a.type === k));
  const S = (sports as readonly string[]).includes(searchParams.s ?? "") ? searchParams.s! : "all";
  const endurance = S === "RUN" || S === "RIDE" || S === "HIKE";
  const noun = S === "WORKOUT" || S === "all" ? "séance" : "sortie";

  const qs = (o: Record<string, string>) => `/analysis?${new URLSearchParams({ ...periodParams(period), s: S, ...o })}`;
  // Filtre actif : encre (comme les filtres d'Activités) ; le Volt reste à l'action principale.
  const chip = (on: boolean) => cn("inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.97]", on ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft");

  // Coach IA : dernier debrief enregistré pour cet onglet et cette période (aucun appel à l'IA au chargement). Pas d'IA pour le vélo ni la rando.
  const aiScope = S === "all" || S === "RUN" || S === "WORKOUT" ? S : null;
  const aiProps = async () => ({
    params: { w: String(W), ...(period.current ? {} : { to: period.endKey }), s: S },
    initial: await lastDebrief(uid, S as "all" | "RUN" | "WORKOUT", W, period.endKey).catch(() => null), configured: !!process.env.ANTHROPIC_API_KEY?.trim(),
  });
  const planSport = S === "RUN" || S === "WORKOUT" ? S : undefined;

  const hit = (a: { type: string }) => S === "all" || a.type === S;
  const cur = inPeriod.filter(hit), prev = acts.filter((a) => { const k = ago(a.startedAt); return k >= W && k < 2 * W && hit(a); });
  // Sorties par semaine : toujours le calcul du coach (activités / semaines de la période)
  const perWeekOf = (l: { startedAt: Date }[]) => sessionsPerWeek(l, coachPeriod) ?? l.length / W;
  const perWeek = perWeekOf(cur);

  // Muscu : les séries du programme (modèles haut / bas) servent à la cible affichée, comme sur la page Programme.
  const program = S === "WORKOUT" ? await getStrengthProgram(uid, now) : null;
  const setsByKey = new Map(program?.groups.flatMap((g) => g.rows).map((r) => [r.key, r.sets]) ?? []);
  const bodyKg = S === "WORKOUT" ? (await prisma.user.findUnique({ where: { id: uid }, select: { weightKg: true } }))?.weightKg ?? 70 : 70;
  const [adv, runGoal, plans, ai, strength, cycling, hiking] = await Promise.all([
    getAdvanced(uid, TZ),
    S === "RUN" ? getRunGoal(uid) : null,
    S === "RUN" || S === "WORKOUT" || S === "all" ? getPlanAdherence(uid, period.startKey, period.endKey, todayKey, planSport) : [],
    aiScope && cur.length > 0 ? aiProps() : null,
    S === "WORKOUT" ? getStrengthAnalysis(uid, TZ, W, now, (k) => setsByKey.get(k), bodyKg) : null,
    S === "RIDE" ? getCyclingAnalysis(uid, TZ, W, now) : null,
    S === "HIKE" ? getHikingAnalysis(uid, TZ, W, now) : null,
  ]);

  const insight = (id: string, text: string): CoachNote => ({ id, tone: "info", title: text, body: "" });
  const notes = rankNotes(
    S === "RUN" ? runNotes({ acts, period: coachPeriod, goal: runGoal, plans })
    : S === "WORKOUT" ? strengthNotes({ data: strength!, period: coachPeriod, plans, perWeek: sessionsPerWeek(cur, coachPeriod) })
    : S === "RIDE" ? cycling!.insights.map((t, i) => insight(`ride-${i}`, t))
    : S === "HIKE" ? hiking!.insights.map((t, i) => insight(`hike-${i}`, t))
    : overviewNotes({ acts, period: coachPeriod, plans }),
    MAX_NOTES,
  );

  // 1. Chiffres clés de l'Évolution : séances, temps, jours actifs, chacun une fois.
  // Variation par jour sur la période contre la précédente, comme le coach (timeChange / rateChange), seulement avec au moins 2 activités de référence.
  // Période précédente hors norme (séjour, stage : `exceptionalPrevious`, même détection que le coach) : le temps se compare au volume hebdomadaire
  // habituel, les autres chiffres n'ont pas d'écart (jamais de « −81 % » qui ne dit rien).
  const spanF = frame(coachPeriod), timeS = (l: { movingTimeS: number }[]) => sum(l, (a) => a.movingTimeS);
  const meaningful = prev.length >= 2 && cur.length > 0;
  const odd = meaningful ? exceptionalPrevious(acts.filter(hit), coachPeriod) : null;
  const daysOf = (l: { startedAt: Date }[]) => new Set(l.map((a) => dayKey(a.startedAt, TZ))).size;
  const activeDays = daysOf(cur);
  const change = (pct: number | null, suffix?: string) =>
    pct == null ? undefined : <><Delta tone={pct >= 0 ? "good" : "neutral"}>{pct > 0 ? "+" : ""}{pct} %</Delta>{suffix && <span className="ml-1.5">{suffix}</span>}</>;
  const timeDelta = !meaningful ? undefined
    : odd ? change(Math.round(((timeS(cur) / spanF.span) * 7 / odd.typicalS - 1) * 100), "vs habituel")
    : change(timeChange(acts.filter(hit), coachPeriod).pct);
  const keyNumbers = (
    <dl className="grid grid-cols-3 gap-3">
      <Metric label={noun === "séance" ? "Séances" : "Sorties"} value={cur.length} size="md" hint={meaningful && !odd ? change(rateChange(cur.length, spanF.span, prev.length, spanF.prevSpan)) : undefined} />
      <Metric label="Temps" value={fmtDuration(timeS(cur))} size="md" hint={timeDelta} />
      <Metric label="Jours actifs" value={activeDays} unit={`/ ${W * 7}`} size="md" hint={meaningful && !odd ? change(rateChange(activeDays, spanF.span, daysOf(prev), spanF.prevSpan)) : undefined} />
    </dl>
  );

  // 2. Évolution : volume par semaine (jours sans activité à 0 : l'axe X reste continu), allure (course), puissance (vélo)
  const daily = fillMissingDates(acts.filter(hit), shiftDay(mon, -7 * (W - 1)), today, TZ);
  const weeks = groupByWeek(daily);
  // Unité du volume : km (endurance), séances par semaine (musculation), heures (Tous)
  const unit = endurance ? "km" : S === "WORKOUT" ? "séances" : "h";
  const volumeLabel = endurance ? "Distance" : S === "WORKOUT" ? "Séances" : "Durée";
  const weekly = S === "WORKOUT"
    ? strength!.weekly.map((w) => ({ label: lab(w.weekStart), value: w.sessions }))
    : weeks.map((w) => ({ label: lab(w.weekStart), value: endurance ? w.distance : w.time / 3600 }));
  const pace = S === "RUN"
    ? Array.from({ length: W }, (_, i) => { const k = W - 1 - i, r = acts.filter((a) => a.type === "RUN" && a.distanceM >= 2000 && ago(a.startedAt) === k); return r.length ? { label: lab(shiftDay(mon, -7 * k)), value: sum(r, (a) => a.movingTimeS) / 60 / (sum(r, (a) => a.distanceM) / 1000) } : null; }).filter((p): p is { label: string; value: number } => !!p)
    : undefined;

  // Forme (Tous) : fitness 42 j, fatigue 7 j, fraîcheur = fitness − fatigue, sur 84 jours ; seulement si une séance a une charge
  const fit = S === "all" && acts.some((a) => (a.load ?? 0) > 0) ? formSeries(acts, now, TZ, FITNESS_HISTORY_DAYS) : null, fitEnd = fit?.[fit.length - 1];
  const form = fit && fitEnd ? { series: fit.slice(-84), ctl: fitEnd.ctl, atl: fitEnd.atl, form: fitEnd.form, zone: formZone(fitEnd.form) } : null;
  // Zones par semaine (Vélo) : puissance, sinon FC ; mêmes séries que l'ancien bloc « Temps par zone »
  const zones = cycling?.zones && cycling.zonesWeekly
    ? { kind: cycling.zones.kind, ref: cycling.zones.ref, ftpManual: cycling.ftp.manual, rides: cycling.zones.rides, weeks: cycling.zonesWeekly }
    : null;
  // Progression (Musculation) : d'abord les exercices du programme actif (Haut : B, A, C ; Bas : F, G, H, dans cet ordre), puis les autres du plus récent au plus ancien
  const programOrder = BUILT_IN.flatMap((t) => t.codes).map((c) => c.toLowerCase());
  const rank = (key: string) => { const r = programOrder.indexOf(/^lafay:([a-z])/.exec(key)?.[1] ?? ""); return r < 0 ? programOrder.length : r; };
  const progression = strength
    ? strength.exercises.filter((e) => inCatalogue(e.key, e.name)).sort((a, b) => rank(a.key) - rank(b.key) || Number(b.sessions >= 2) - Number(a.sessions >= 2) || b.lastDay.localeCompare(a.lastDay)).slice(0, MAX_LADDERS)
        .map((e) => {
          // Libellé = la variante réellement faite (« A1 · Pompes », « A3 · Pompes serrées »), jamais un code nu ni la seule lettre de la famille
          const l = ladderInfo(e.key), code = e.variant ?? l?.code ?? null, ce = code ? catalogExercise(code) : undefined;
          return { key: e.key, name: ce ? `${ce.code ?? code} · ${ce.name}` : l?.label ?? e.name, variant: code, level: e.level, lastDay: e.lastDay, hint: e.hint, points: e.points }; })
    : null;

  // 3. Par sport : temps de la période par sport (vélo d'intérieur à part, « Home trainer »), seulement ceux qui ont du temps ; masqué s'il n'y en a qu'un.
  const tt = timeS(cur) || 1;
  const split = [
    ...MY_SPORTS.map((k) => ({ k, s: k as string, label: SPORTS[k].label, l: cur.filter((a) => a.type === k && !isTrainer(a)), faded: false })),
    { k: "TRAINER", s: "RIDE", label: "Home trainer", l: cur.filter(isTrainer), faded: true },
  ].map((x) => ({ ...x, pct: (timeS(x.l) / tt) * 100, time: timeS(x.l), style: activityStyle(x.s) })).filter((x) => x.time > 0).sort((a, b) => b.time - a.time);
  let off = 0;

  // Plus de détails — Profil : sorties par semaine de chaque discipline sur la période
  const perWeekByType = Object.fromEntries(MY_SPORTS.map((k) => [k, perWeekOf(inPeriod.filter((a) => a.type === k))])) as Record<(typeof MY_SPORTS)[number], number>;

  // Plus de détails — À retenir (sans les jours actifs, déjà dans les chiffres clés)
  const bestWeek = Math.max(0, ...weeks.map((w) => (endurance ? w.distance : w.time / 3600))), longest = Math.max(0, ...cur.map((a) => (endurance ? a.distanceM / 1000 : a.movingTimeS)));
  const activeWeeks = weeks.filter((w) => w.time > 0).length, dPlus = sum(cur, (a) => a.elevationGainM);
  const records = endurance
    ? [["Meilleure semaine", `${fmtNum(bestWeek, 1)} km`], ["Plus longue sortie", `${fmtNum(longest, 1)} km`], ["Dénivelé en repères", climbCompare(dPlus, mon)?.short ?? `${fmtNum(dPlus, 0)} m`], ["Semaines actives", `${activeWeeks}/${W}`]]
    : [["Meilleure semaine", `${fmtNum(bestWeek, 1)} h`], ["Plus longue séance", fmtDuration(longest)], ["Semaines actives", `${activeWeeks}/${W}`], ["Durée moyenne", cur.length ? fmtDuration(timeS(cur) / cur.length) : "–"]];

  // Plus de détails — Régularité : calendrier de 26 semaines (minutes par jour) et sorties par jour de la semaine
  const minutes = new Map<string, number>();
  for (const a of acts.filter(hit)) { const key = `${ago(a.startedAt)}-${dow(dayKey(a.startedAt, TZ))}`; minutes.set(key, (minutes.get(key) ?? 0) + a.movingTimeS / 60); }
  const cells: DayCell[] = Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i) => {
    const c = CALENDAR_WEEKS - 1 - Math.floor(i / 7), r = i % 7, min = Math.round(minutes.get(`${c}-${r}`) ?? 0);
    return { min, future: c === 0 && r > dow(today), title: min ? `${lab(shiftDay(mon, -7 * c + r))} : ${fmtDuration(min * 60)}` : undefined };
  });
  const weekdays = [0, 1, 2, 3, 4, 5, 6].map((r) => cur.filter((a) => dow(dayKey(a.startedAt, TZ)) === r).length);

  return (
    <>
      <TopBar title="Analyse" />
      <PeriodPicker weeks={W} current={period.current} endKey={period.endKey} startKey={period.startKey} preset={period.preset} today={todayKey} />
      <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
        {[["all", "Tous"], ...sports.map((k) => [k, SPORTS[k].label])].map(([k, l]) => <Link key={k} href={qs({ s: k })} className={chip(S === k)}>{l}</Link>)}
      </div>

      <div className="mt-6 space-y-8">
        <CoachCard notes={notes} ai={ai} />

        {cur.length === 0 ? (
          <div className={cn(ui.card, "p-6 text-center")}>
            <p className="text-metric-sm font-semibold">Aucune {noun} sur {W} semaine{W > 1 ? "s" : ""}</p>
            <p className="mt-1 text-sm text-ink-soft">Les activités douces (vélotaf, marche) ne comptent pas comme entraînement.</p>
            <Link href={S === "WORKOUT" ? "/record/session" : "/record"} className={cn(ui.btnPrimary, "mt-5 w-full")}>{S === "WORKOUT" ? "Démarrer une séance" : "Enregistrer une sortie"}</Link>
          </div>
        ) : (
          <>
            <EvolutionCard key={S} summary={keyNumbers} weekly={weekly} unit={unit} volumeLabel={volumeLabel} pace={pace} power={S === "RIDE" ? { record: adv.record, recent: adv.last30 } : null} form={form} zones={zones} progression={progression} />

            {split.length > 1 && (
              <Section title="Par sport">
                <div className={cn(ui.card, "flex items-center gap-4 p-4")}>
                  <svg viewBox="0 0 42 42" className="size-28 shrink-0 -rotate-90" role="img" aria-label="Répartition du temps par sport">
                    <circle cx="21" cy="21" r="15.915" fill="none" className="stroke-surface-2" strokeWidth="6" />
                    {split.map((s) => { const o = off; off += s.pct; return <circle key={s.k} cx="21" cy="21" r="15.915" fill="none" className={cn(s.style.stroke, s.faded && "opacity-50")} strokeWidth="6" strokeDasharray={`${Math.max(s.pct - 0.8, 0.1).toFixed(2)} ${(100 - Math.max(s.pct - 0.8, 0.1)).toFixed(2)}`} strokeDashoffset={-o.toFixed(2)} />; })}
                  </svg>
                  <ul className="min-w-0 flex-1">
                    {split.map((s) => (
                      <li key={s.k}>
                        <Link href={qs({ s: s.s })} className="flex min-h-12 items-center gap-2.5">
                          <i className={cn("size-3 shrink-0 rounded-sm", s.style.dot, s.faded && "opacity-50")} aria-hidden />
                          <span className="min-w-0 flex-1 truncate">{s.label}</span>
                          <b className="font-num text-metric-sm tabular-nums">{Math.round(s.pct)} %</b>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </Section>
            )}

            {/* Le reste, replié par défaut : la page se lit en trois blocs. */}
            <details className="group">
              <summary className={cn(ui.card, "flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 [&::-webkit-details-marker]:hidden")}>
                <span className="text-[15px] font-semibold text-ink">Plus de détails</span>
                <ChevronDown className="size-5 shrink-0 text-ink-mute transition-transform duration-150 group-open:rotate-180" aria-hidden />
              </summary>
              <div className="mt-8 space-y-8">
                <ProfileCard profiles={adv.profiles} sport={S} perWeek={perWeekByType} />

                <Section title="À retenir">
                  <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card bg-line">
                    {records.map(([l, v]) => <Metric key={l} label={l} value={v} size="md" className="bg-surface px-4 py-3" />)}
                  </dl>
                </Section>

                <RegularityCard cells={cells} weekdays={weekdays} perWeek={perWeek} noun={noun} />

                {strength && (
                  <Section title="Muscles sollicités">
                    <div className={cn(ui.card, "p-4")}><MuscleVolume data={strength.muscles} weeks={W} span={weeksLabel(W)} /></div>
                  </Section>
                )}
              </div>
            </details>
          </>
        )}
      </div>
    </>
  );
}
