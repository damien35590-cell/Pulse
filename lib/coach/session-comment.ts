/**
 * Commentaire automatique d'une séance terminée : rassemble les données en base, calcule le verdict (session-verdict.ts),
 * puis rédige avec le gabarit déterministe et le garde-fou (comment-templates.ts, comment-guard.ts). Aucun appel LLM.
 */
import { prisma } from "../prisma";
import { dayKey, localHour } from "../dates";
import { isCommute } from "../routes/estimate";
import { loadHistory } from "../workout/history";
import { getCurrentVma } from "../data/training";
import { getZones } from "../data/zones";
import { DEFAULT_VMA } from "../training/vma";
import { resolveSteps } from "../training/resolve";
import { bounds, HR_PCT } from "../zones";
import { groupKey } from "../analytics/strength";
import type { RunWorkoutStructure } from "@/types/training";
import { computeVerdict, type PlanTarget, type TrackSample, type Verdict } from "./session-verdict";
import { commentTemplate } from "./comment-templates";
import { resolveComment } from "./comment-guard";

const EF_KINDS = ["EASY", "RECOVERY", "LONG_RUN"];
const HISTORY_DAYS = 90;

/** Cible de la séance de programme liée à la sortie, seulement pour les séances d'endurance (l'allure moyenne n'a pas de sens en fractionné). */
async function planTarget(activityId: string, userId: string): Promise<PlanTarget | null> {
  const p = await prisma.plannedSession.findUnique({ where: { completedActivityId: activityId }, select: { kind: true, structure: true } });
  if (!p?.structure || !EF_KINDS.includes(p.kind)) return null;
  const steps = (p.structure as unknown as RunWorkoutStructure).steps;
  const main = steps.flatMap((s) => (s.kind === "repeat" ? s.steps : [s])).filter((s) => s.kind === "step" && s.role === "active");
  const target = main.length === 1 && main[0].kind === "step" ? main[0].target : undefined;
  if (!target) return null;
  if (target.ref === "HR_ZONE") {
    const hrMax = (await getZones(userId)).hrMax;
    if (!hrMax) return null;
    const b = bounds(hrMax, HR_PCT);
    return { label: "EF", hr: [target.zone === 1 ? 0 : b[target.zone - 2], b[target.zone - 1]] };
  }
  const vma = (await getCurrentVma(userId))?.vmaKmh ?? DEFAULT_VMA.vmaKmh;
  const r = resolveSteps({ version: 1, steps: [{ kind: "step", role: "active", duration: { type: "lap" }, target }] }, vma)[0]?.paceSPerKm;
  return r ? { label: "EF", paceSKm: [r.min, r.max] } : null;
}

type Point = { t?: number; lat?: number; lng?: number; hr?: number };
async function samplesOf(activityId: string, trackPoints: unknown): Promise<TrackSample[]> {
  const pts = (Array.isArray(trackPoints) ? trackPoints : []) as Point[];
  if (pts.some((p) => (p.hr ?? 0) > 0)) return pts.filter((p) => p.t != null).map((p) => ({ t: p.t!, lat: p.lat, lng: p.lng, hr: p.hr }));
  // Trace compactée sans FC : on la relit dans la série à 1 Hz.
  const s = await prisma.activityStream.findUnique({ where: { activityId }, select: { data: true } });
  const d = s?.data as { t0?: number; hr?: number[] } | null;
  if (!d?.hr?.length || d.t0 == null) return [];
  return pts.filter((p) => p.t != null).map((p) => ({ t: p.t!, lat: p.lat, lng: p.lng, hr: d.hr![Math.round((p.t! - d.t0!) / 1000)] }));
}

/** Verdict de la séance, ou null (activité exclue, ou rien de factuel à dire). `records` : records battus par cette sortie. */
export async function verdictForActivity(activityId: string, records: { label?: string; value: number; beaten: boolean }[]): Promise<Verdict | null> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, userId: true, type: true, title: true, source: true, dedupeKey: true, startedAt: true, feeling: true, distanceM: true, movingTimeS: true, avgHr: true, kind: true, trackPoints: true },
  });
  if (!a) return null;
  if (isCommute(a)) return null;
  const tz = (await prisma.user.findUnique({ where: { id: a.userId }, select: { timezone: true } }))?.timezone ?? "Europe/Paris";
  const today = dayKey(a.startedAt, tz);
  const earlier = (await prisma.activity.findMany({
    where: { userId: a.userId, id: { not: a.id }, startedAt: { gte: new Date(+a.startedAt - 864e5), lt: a.startedAt } },
    select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true },
  })).filter((o) => dayKey(o.startedAt, tz) === today && !isCommute(o));
  const base = { type: a.type, title: a.title, source: a.source, dedupeKey: a.dedupeKey, startHour: localHour(a.startedAt, tz), secondOfDay: earlier.length > 0, feeling: a.feeling };

  if (a.type === "WORKOUT") {
    const mine = await prisma.workoutExercise.findMany({ where: { activityId: a.id }, select: { name: true } });
    const history = await loadHistory(a.userId);
    const keys = [...new Set(mine.map((e) => groupKey(e.name)).filter((k): k is string => !!k))];
    // Une séance non encore enregistrée au moment du chargement ne figure pas dans l'historique : sans elle, pas de comparaison.
    const exercises = keys.map((k) => ({ rows: history.get(k) ?? [] })).filter((e) => e.rows[0]?.activityId === a.id);
    return computeVerdict({ ...base, workoutKind: a.kind, exercises });
  }

  const recentRuns = a.type === "RUN"
    ? (await prisma.activity.findMany({
      where: { userId: a.userId, type: "RUN", id: { not: a.id }, avgHr: { gt: 0 }, distanceM: { gte: 2000 }, startedAt: { gte: new Date(+a.startedAt - HISTORY_DAYS * 864e5), lt: a.startedAt } },
      orderBy: { startedAt: "desc" }, take: 40, select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true, avgHr: true },
    })).filter((r) => !isCommute(r) && r.movingTimeS > 0).map((r) => ({ paceSKm: r.movingTimeS / (r.distanceM / 1000), avgHr: r.avgHr! }))
    : [];
  return computeVerdict({
    ...base, distanceM: a.distanceM, movingTimeS: a.movingTimeS, avgHr: a.avgHr, recentRuns,
    samples: await samplesOf(a.id, a.trackPoints),
    records: records.filter((r) => r.beaten && r.label).map((r) => ({ label: r.label!, timeS: r.value })),
    plan: a.type === "RUN" ? await planTarget(a.id, a.userId) : null,
  });
}

/** Commentaire final (kind + texte) d'une séance, ou null. */
export async function commentForActivity(activityId: string, records: { label?: string; value: number; beaten: boolean }[]) {
  const v = await verdictForActivity(activityId, records);
  return v ? { kind: v.kind, text: await resolveComment(v.kind, commentTemplate(v)) } : null;
}
