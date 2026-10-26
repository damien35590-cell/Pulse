import type { ActivityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayKey, weekKeys } from "@/lib/dates";
import { classContext, contextChips, paceInsight, sessionClass, WINDOW_DAYS, type Candidate, type InsightLine, type PaceInsight, type SessionClass } from "@/lib/activity/comparables";
import { doneSets, entriesOf, groupKey, stallsOf, sumReps, type StrengthRow } from "@/lib/analytics/strength";
import type { SetDetail } from "@/lib/exercises";
import { applyLafayProgress } from "@/lib/workout/lafay";
import { catalogFor, resolveName } from "@/lib/workout/catalog";
import { exerciseCode } from "@/lib/art/set-bars";

const DAY = 86_400_000;
const select = {
  id: true, type: true, startedAt: true, distanceM: true, movingTimeS: true, avgHr: true, rpe: true, kind: true, templateId: true,
  plannedSession: { select: { kind: true, isKeySession: true } }, raceEvent: { select: { id: true } },
} as const;

type Row = { id: string; type: string; startedAt: Date; distanceM: number; movingTimeS: number; avgHr: number | null; rpe: number | null; kind: string | null; templateId: string | null; plannedSession: { kind: string; isKeySession: boolean } | null; raceEvent: { id: string } | null };
const toCandidate = (r: Row): Candidate & Pick<Row, "kind" | "templateId"> => ({ ...r, planned: r.plannedSession, race: !!r.raceEvent });

export type ActivityInsight = { pace: PaceInsight | null; chips: string[]; /** Genre de séance (même classement que la comparaison). */ cls?: SessionClass; /** Muscu : phrase de contexte de la carte (strengthLine). */ strength?: InsightLine; /** Rang dans la semaine (1 = première sortie) : dernier recours pour la phrase d'une carte d'endurance. */ weekRank?: number };
const EMPTY: ActivityInsight = { pace: null, chips: [] };

const isTimed = (name: string) => { const { code, variant } = resolveName(name); return catalogFor(code, variant)?.mode === "time"; };

type StrengthTarget = { id: string; startedAt: Date; kind: string | null; templateId: string | null };
type StrengthHistory = StrengthRow & { kind: string | null; templateId: string | null };

type Half = "HAUT" | "BAS";
const UPPER = new Set(["A", "B", "C", "J", "K"]), LOWER = new Set(["E", "F", "G", "H", "W"]);
const UPPER_RE = /pompe|traction|dips|d[ée]velopp[ée]|rowing|tirage|curl|[ée]paule|biceps|triceps|pectoraux|dos/i;
const LOWER_RE = /squat|pistol|fente|soulev[ée] de terre|mollet|jambe|cuisse|fessier|hip thrust|presse/i;
const halfOfExercise = (name: string): Half | null => {
  const { code } = resolveName(name);
  if (UPPER.has(code)) return "HAUT";
  if (LOWER.has(code)) return "BAS";
  return UPPER_RE.test(name) ? "HAUT" : LOWER_RE.test(name) ? "BAS" : null;
};
/** Moitié du corps d'une séance : celle enregistrée, sinon déduite des exercices (une seule moitié représentée, sinon aucune). */
export function halfOf(kind: string | null, names: string[]): Half | null {
  if (kind === "HAUT" || kind === "BAS") return kind;
  const halves = new Set(names.map(halfOfExercise).filter((h): h is Half => h !== null));
  return halves.size === 1 ? [...halves][0] : null;
}

/**
 * Phrase de contexte d'une séance de muscu, par priorité : blocage Lafay (règles du verdict de séance), total de répétitions comparé à la
 * séance précédente du même type (même modèle, sinon même moitié du corps, enregistrée ou déduite), sinon le total seul.
 * `history` : lignes d'exercices de l'utilisateur, séance incluse.
 */
export function strengthLine(t: StrengthTarget, history: StrengthHistory[]): InsightLine | null {
  const total = (rows: StrengthRow[]) => rows.filter((r) => !isTimed(r.name)).reduce((s, r) => s + sumReps(doneSets(r)), 0);
  const upTo = history.filter((r) => +r.startedAt <= +t.startedAt);
  const mine = upTo.filter((r) => r.activityId === t.id);
  if (!mine.length) return null;

  for (const key of new Set(mine.map((r) => groupKey(r.name)))) {
    const rows = upTo.filter((r) => groupKey(r.name) === key).sort((a, b) => +b.startedAt - +a.startedAt);
    const change = applyLafayProgress(rows)?.change;
    if ((change === "evolve" || change === "restart") && stallsOf(entriesOf(rows)) >= 2) return { text: `Blocage sur ${exerciseCode(rows[0].name)} : 2ᵉ séance`, tone: "warn" };
  }

  const cur = total(mine), half = halfOf(t.kind, mine.map((r) => r.name));
  const others = new Map<string, StrengthHistory[]>();
  for (const r of upTo) if (r.activityId !== t.id) others.set(r.activityId, [...(others.get(r.activityId) ?? []), r]);
  const prev = [...others.values()]
    .filter((rows) => (t.templateId && rows[0].templateId === t.templateId) || (half !== null && halfOf(rows[0].kind, rows.map((r) => r.name)) === half))
    .sort((a, b) => +b[0].startedAt - +a[0].startedAt)[0];
  if (!prev) return { text: `${cur} reps au total`, tone: "neutral" };
  const d = cur - total(prev);
  if (d > 0) return { text: `Total en hausse : ${cur} reps (+${d})`, tone: "good" };
  if (d < 0) return { text: `Total en baisse : ${cur} reps (−${-d})`, tone: "warn" };
  return { text: `Égal à la dernière séance (${cur} reps)`, tone: "neutral" };
}

/** Rang de l'activité dans sa semaine, parmi les sorties du même sport. */
function weekRank(target: Candidate, pool: Candidate[], tz: string) {
  const week = new Set(weekKeys(target.startedAt, tz));
  return 1 + pool.filter((c) => week.has(dayKey(c.startedAt, tz)) && +c.startedAt < +target.startedAt).length;
}

/** Fenêtre utile d'une activité : 90 jours avant, jusqu'à la fin de son mois et de sa semaine (une journée de marge pour le fuseau). */
function span(a: { startedAt: Date }, tz: string) {
  const [y, m] = dayKey(a.startedAt, tz).split("-").map(Number);
  return {
    start: Math.min(+a.startedAt - WINDOW_DAYS * DAY, Date.UTC(y, m - 1, 1) - DAY),
    end: Math.max(Date.UTC(y, m, 2), Date.parse(weekKeys(a.startedAt, tz)[6]) + 2 * DAY),
  };
}

/**
 * Comparaison d'allure + pastilles de contexte pour plusieurs activités d'un coup (fil, fiche) : trois requêtes au total,
 * quel que soit le nombre d'activités (cibles, fenêtre commune, records).
 */
export async function getActivityInsights(userId: string, ids: string[], tz: string, hrMax?: number | null): Promise<Map<string, ActivityInsight>> {
  const out = new Map<string, ActivityInsight>();
  if (!ids.length) return out;
  const targets = (await prisma.activity.findMany({ where: { id: { in: ids }, userId }, select })).map(toCandidate);
  if (!targets.length) return out;
  const spans = targets.map((t) => span(t, tz));
  const [rows, records] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, type: { in: [...new Set(targets.map((t) => t.type))] as ActivityType[] }, startedAt: { gte: new Date(Math.min(...spans.map((s) => s.start))), lt: new Date(Math.max(...spans.map((s) => s.end))) } },
      select,
    }),
    prisma.personalRecord.findMany({ where: { userId, activityId: { in: targets.map((t) => t.id) } }, select: { kind: true, activityId: true } }),
  ]);
  const all = rows.map(toCandidate);
  const lifts = targets.filter((t) => t.type === "WORKOUT");
  const history: StrengthHistory[] = lifts.length
    ? (await prisma.workoutExercise.findMany({
      where: { activity: { userId, type: "WORKOUT", startedAt: { gte: new Date(Math.min(...lifts.map((t) => +t.startedAt)) - 120 * DAY), lte: new Date(Math.max(...lifts.map((t) => +t.startedAt))) } } },
      select: { activityId: true, name: true, sets: true, reps: true, loadKg: true, setsDetail: true, activity: { select: { startedAt: true, kind: true, templateId: true } } },
    })).map((e) => ({
      activityId: e.activityId, startedAt: e.activity.startedAt, name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg,
      setsDetail: Array.isArray(e.setsDetail) ? (e.setsDetail as unknown as SetDetail[]) : null, kind: e.activity.kind, templateId: e.activity.templateId,
    }))
    : [];
  targets.forEach((target, i) => {
    const { start, end } = spans[i];
    const pool = all.filter((c) => c.id !== target.id && c.type === target.type && +c.startedAt >= start && +c.startedAt < end);
    const ctx = classContext(target, pool, hrMax);
    const recs = records.filter((r) => r.activityId === target.id).map((r) => r.kind);
    out.set(target.id, { pace: paceInsight(target, pool, ctx), chips: contextChips(target, pool, { tz, records: recs, ctx }), cls: sessionClass(target, ctx), weekRank: target.type === "WORKOUT" ? undefined : weekRank(target, pool, tz), strength: (target.type === "WORKOUT" ? strengthLine(target, history) : null) ?? undefined });
  });
  return out;
}

/** Comparaison d'allure + pastilles de contexte pour la fiche d'une activité. */
export async function getActivityInsight(userId: string, activityId: string, tz: string, hrMax?: number | null): Promise<ActivityInsight> {
  return (await getActivityInsights(userId, [activityId], tz, hrMax)).get(activityId) ?? EMPTY;
}
