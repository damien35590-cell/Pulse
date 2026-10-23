/**
 * Vue d'ensemble « Tous les sports » de la page Analyse. Activités douces (isCommute : vélotaf, marche, Google Fit) exclues de tous les calculs,
 * pas de distance cumulée tous sports confondus. Charge = Activity.load (lib/load.ts), forme = fitnessSeries (lib/fitness.ts) ;
 * les phrases « à retenir » viennent des générateurs des onglets dédiés (muscu, vélo, rando).
 * buildOverview est pure (tests : tools/test-overview.ts).
 */
import { prisma } from "../prisma";
import { dayKey, shiftDay, weekKeys } from "../dates";
import { estimateLoad } from "../load";
import { fitnessSeries, zone, type Fit } from "../fitness";
import { isCommute } from "../routes/estimate";
import { getStrengthAnalysis } from "./strength";
import { getCyclingAnalysis } from "./cycling";
import { getHikingAnalysis } from "./hiking";
import { overviewNotes, type CoachNote, type PlanAdherence } from "./coach-notes";

export type SportGroup = "WORKOUT" | "RUN" | "RIDE" | "HIKE" | "OTHER";
export const GROUPS: readonly SportGroup[] = ["WORKOUT", "RUN", "RIDE", "HIKE", "OTHER"];
/** Historique lu : de quoi chauffer la forme (fitness sur 42 j) et compter les semaines actives d'affilée. */
const HISTORY_DAYS = 330;
const FORM_DAYS = 84;

export type OverviewAct = { type: string; title: string; source: string; dedupeKey: string | null; startedAt: Date; distanceM: number; movingTimeS: number; load: number | null };
export type OverviewAnalysis = {
  empty: boolean;
  summary: { sessions: number; timeS: number; load: number | null; activeDays: number };
  weekly: { weekStart: string; hours: Record<SportGroup, number> }[];
  form: { series: Fit[]; ctl: number; atl: number; form: number; zone: { label: string; tip: string } } | null;
  split: { group: SportGroup; timeS: number; sessions: number; timePct: number; sessionsPct: number }[];
  regularity: { perWeek: number; activeStreak: number };
  insights: string[];
  footer: { softTimeS: number; softCount: number };
};
/** Phrases « à retenir » déjà générées par les onglets dédiés (la première est la plus marquante). */
export type SportInsights = Partial<Record<"WORKOUT" | "RIDE" | "HIKE", string[]>>;

const groupOf = (type: string): SportGroup => (type === "WORKOUT" || type === "RUN" || type === "RIDE" || type === "HIKE" ? type : "OTHER");
const fr = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export function buildOverview(input: { acts: OverviewAct[]; insights: SportInsights; weeks: number; tz: string; now?: Date }): OverviewAnalysis {
  const { acts, insights, weeks, tz, now = new Date() } = input;
  const mon = weekKeys(now, tz)[0], first = shiftDay(mon, -7 * (weeks - 1));
  const weekIdx = (d: Date) => Math.floor((Date.parse(dayKey(d, tz)) - Date.parse(first)) / (7 * 864e5)); // < 0 avant la période
  const training = acts.filter((a) => !isCommute({ ...a })), soft = acts.filter((a) => isCommute({ ...a }) && weekIdx(a.startedAt) >= 0);
  const cur = training.filter((a) => weekIdx(a.startedAt) >= 0);

  // 1. Résumé : la charge n'est affichée que si au moins une séance en a une d'enregistrée
  const loadOf = (a: OverviewAct) => a.load ?? estimateLoad(a);
  const summary = {
    sessions: cur.length, timeS: cur.reduce((s, a) => s + a.movingTimeS, 0),
    load: cur.some((a) => (a.load ?? 0) > 0) ? Math.round(cur.reduce((s, a) => s + loadOf(a), 0)) : null,
    activeDays: new Set(cur.map((a) => dayKey(a.startedAt, tz))).size,
  };

  // 2. Heures par semaine et par sport
  const weekly = Array.from({ length: weeks }, (_, i) => ({ weekStart: shiftDay(first, 7 * i), hours: { WORKOUT: 0, RUN: 0, RIDE: 0, HIKE: 0, OTHER: 0 } as Record<SportGroup, number> }));
  for (const a of cur) weekly[weekIdx(a.startedAt)].hours[groupOf(a.type)] += a.movingTimeS / 3600;

  // 3. Forme : fitness (42 j), fatigue (7 j), fraîcheur = fitness − fatigue
  const all = fitnessSeries(training, now, tz, HISTORY_DAYS), t = all[all.length - 1];
  const form = training.some((a) => loadOf(a) > 0) ? { series: all.slice(-FORM_DAYS), ctl: t.ctl, atl: t.atl, form: t.form, zone: zone(t.form) } : null;

  // 4. Répartition en temps et en nombre de séances
  const split = GROUPS.map((g) => {
    const l = cur.filter((a) => groupOf(a.type) === g);
    return { group: g, timeS: l.reduce((s, a) => s + a.movingTimeS, 0), sessions: l.length, timePct: 0, sessionsPct: 0 };
  }).filter((x) => x.sessions > 0).sort((a, b) => b.timeS - a.timeS);
  for (const x of split) { x.timePct = Math.round((x.timeS / (summary.timeS || 1)) * 100); x.sessionsPct = Math.round((x.sessions / (summary.sessions || 1)) * 100); }

  // 5. Régularité : moyenne sur les semaines terminées ; semaines actives d'affilée jusqu'à aujourd'hui (la semaine en cours vide ne casse pas la série)
  const perWeekCount = weekly.map((_, i) => cur.filter((a) => weekIdx(a.startedAt) === i).length);
  const counted = weeks > 1 ? perWeekCount.slice(0, -1) : perWeekCount;
  const activeWeeks = new Set(training.map((a) => weekIdx(a.startedAt)));
  let streak = 0, w = weeks - 1;
  if (!activeWeeks.has(w)) w--;
  while (activeWeeks.has(w)) { streak++; w--; }
  const regularity = { perWeek: counted.reduce((s, n) => s + n, 0) / counted.length, activeStreak: streak };

  // 6. À retenir : la phrase la plus marquante de chaque sport, les sports les plus pratiqués d'abord, 3 au plus
  const runs = cur.filter((a) => a.type === "RUN"), longest = runs.sort((a, b) => b.distanceM - a.distanceM)[0];
  const bySport: Partial<Record<SportGroup, string>> = {
    WORKOUT: insights.WORKOUT?.[0], RIDE: insights.RIDE?.[0], HIKE: insights.HIKE?.[0],
    RUN: longest && longest.distanceM >= 1000 ? `Plus longue sortie running : ${fr(longest.distanceM / 1000)} km, le ${lab(dayKey(longest.startedAt, tz))}.` : undefined,
  };
  const sentences = split.map((x) => bySport[x.group]).filter((s): s is string => !!s).slice(0, 3);

  return {
    empty: cur.length === 0, summary, weekly, form, split, regularity, insights: sentences,
    footer: { softTimeS: soft.reduce((s, a) => s + a.movingTimeS, 0), softCount: soft.length },
  };
}

/** `current` : la période se termine aujourd'hui ; `plans` : suivi des programmes, pour « Le mot du coach ». */
export async function getOverview(userId: string, tz: string, weeks: number, now = new Date(), opts: { current?: boolean; plans?: PlanAdherence[] } = {}): Promise<OverviewAnalysis & { notes: CoachNote[] }> {
  const [acts, strength, cycling, hiking] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: new Date(+now - Math.max(HISTORY_DAYS, 14 * weeks + 84) * 864e5), lte: now } },
      select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true, load: true },
    }),
    getStrengthAnalysis(userId, tz, weeks, now),
    getCyclingAnalysis(userId, tz, weeks, now, false), // sans les séries 1 Hz : seules les phrases servent ici
    getHikingAnalysis(userId, tz, weeks, now),
  ]);
  const data = buildOverview({ acts, insights: { WORKOUT: strength.insights, RIDE: cycling.insights, HIKE: hiking.insights }, weeks, tz, now });
  return { ...data, notes: overviewNotes({ acts, period: { weeks, tz, now, current: opts.current ?? true }, plans: opts.plans }) };
}
