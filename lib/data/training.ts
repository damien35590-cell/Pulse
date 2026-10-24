import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { MetricSource, Prisma, SessionKind, SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayKey, weekKeys } from "@/lib/dates";
import type { RunGeneratorInput, RunWorkoutStructure } from "@/types/training";
import { generateRunBaseVma, startMonday } from "@/lib/training/generate";
import { estimateRun, resolveSteps, summarizeRun } from "@/lib/training/resolve";
import { DEFAULT_VMA, pickVma, type CurrentVma } from "@/lib/training/vma";
import { getStoredVma, onThresholdsChange } from "@/lib/data/zone-ribbon";
import { RUN_BASE_VMA, blockOf, weekInBlock } from "@/lib/training/catalog/run-base-vma";

const TZ = "Europe/Paris";
/** Programme « vivant » : actif ou en pause. Un seul par sport. */
const LIVE = { in: ["ACTIVE", "PAUSED"] as ("ACTIVE" | "PAUSED")[] };
/** Une sortie de moins de 10 minutes (échauffement isolé, test de montre) ne valide pas une séance. */
const MIN_LINK_S = 600;
/** La saisie du test VMA reste proposée 14 jours. */
const TEST_PROMPT_DAYS = 14;

const day = (k: string) => new Date(`${k}T00:00:00Z`);
const refresh = () => { try { revalidatePath("/"); revalidatePath("/plan"); } catch { /* hors contexte Next : sans effet */ } };

// ───────── VMA ─────────
/** Dernière VMA mesurée ; à défaut, estimation d'après le record 10 km. */
export async function getCurrentVma(userId: string): Promise<CurrentVma | null> {
  const [metrics, rec] = await Promise.all([
    prisma.athleteMetric.findMany({ where: { userId, type: "VMA_KMH" }, orderBy: { measuredAt: "desc" }, take: 1, select: { value: true, measuredAt: true, source: true } }),
    prisma.personalRecord.findUnique({ where: { userId_kind_type: { userId, kind: "BEST_10K", type: "RUN" } }, select: { value: true, achievedAt: true } }),
  ]);
  return pickVma(metrics, rec && { distanceM: 10000, timeS: rec.value, date: rec.achievedAt });
}

export async function saveVmaMetric(userId: string, vmaKmh: number, source: MetricSource, opts: { note?: string; activityId?: string | null; measuredAt?: Date } = {}) {
  const before = await getStoredVma(userId);
  const m = await prisma.athleteMetric.create({ data: { userId, type: "VMA_KMH", value: Math.round(vmaKmh * 10) / 10, source, measuredAt: opts.measuredAt ?? new Date(), activityId: opts.activityId ?? null, note: opts.note ?? null } });
  // La VMA courante est la dernière mesure : un test daté d'avant la dernière ne la change pas (onThresholdsChange le constate).
  await onThresholdsChange(userId, { vma: before }, { vma: await getStoredVma(userId) });
  return m;
}

// ───────── Création ─────────
/**
 * Crée et active « Reprise & VMA ». Dans une seule transaction : l'ancien programme RUN actif (ou en pause) passe
 * en ABANDONED, la VMA choisie est enregistrée si elle diffère de la dernière mesure, puis le programme est écrit.
 */
export async function createRunProgram(userId: string, o: { sessionsPerWeek: 2 | 3; vmaKmh: number; vmaSource: MetricSource; vmaNote?: string }) {
  const now = new Date();
  const [last, agg] = await Promise.all([
    prisma.athleteMetric.findFirst({ where: { userId, type: "VMA_KMH" }, orderBy: { measuredAt: "desc" }, select: { value: true } }),
    prisma.activity.aggregate({ where: { userId, type: "RUN", startedAt: { gte: new Date(+now - 28 * 864e5) } }, _sum: { distanceM: true } }),
  ]);
  const g = generateRunBaseVma({ sessionsPerWeek: o.sessionsPerWeek, vmaKmh: o.vmaKmh, startDate: startMonday(dayKey(now, TZ)), currentWeeklyDistanceM: (agg._sum.distanceM ?? 0) / 4 });
  const programId = randomUUID(), phaseIds = g.phases.map(() => randomUUID()), weekIds = g.weeks.map(() => randomUUID());

  await prisma.$transaction([
    prisma.program.updateMany({ where: { userId, sport: "RUN", status: LIVE }, data: { status: "ABANDONED" } }),
    ...(last && Math.abs(last.value - o.vmaKmh) < 0.05 ? [] : [prisma.athleteMetric.create({ data: { userId, type: "VMA_KMH", value: o.vmaKmh, source: o.vmaSource, measuredAt: now, note: o.vmaNote ?? null } })]),
    prisma.program.create({ data: {
      id: programId, userId, sport: "RUN", name: g.program.name, templateKey: g.program.templateKey, templateVersion: g.program.templateVersion,
      status: "ACTIVE", schedulingMode: "FLEXIBLE", startDate: day(g.program.startDate), endDate: day(g.program.endDate), totalWeeks: g.program.totalWeeks,
      sessionsPerWeek: g.program.sessionsPerWeek, preferredDays: [], generatorInput: g.program.generatorInput as Prisma.InputJsonValue, activatedAt: now,
    } }),
    prisma.programPhase.createMany({ data: g.phases.map((p, i) => ({ id: phaseIds[i], programId, order: p.order, type: p.type, name: p.name, focus: p.focus })) }),
    prisma.programWeek.createMany({ data: g.weeks.map((w, i) => ({
      id: weekIds[i], programId, phaseId: phaseIds[w.phaseOrder - 1], number: w.number, startDate: day(w.startDate), isRecovery: w.isRecovery,
      targetDistanceM: w.targetDistanceM, volumeFactor: w.isRecovery ? RUN_BASE_VMA.recoveryWeekFactor : 1, note: w.note ?? null,
    })) }),
    prisma.plannedSession.createMany({ data: g.weeks.flatMap((w, i) => w.sessions.map((s) => ({
      programId, weekId: weekIds[i], userId, sport: "RUN" as const, kind: s.kind, date: day(s.date), orderInWeek: s.orderInWeek, title: s.title,
      description: s.description ?? null, isKeySession: s.isKeySession, structure: s.structure as Prisma.InputJsonValue,
      plannedDurationS: s.plannedDurationS, plannedDistanceM: s.plannedDistanceM,
    }))) }),
  ]);
  await onThresholdsChange(userId, { vma: last?.value ?? null }, { vma: o.vmaKmh }); // la VMA du nouveau programme est la plus récente
  return programId;
}

// ───────── File de séances ─────────
/** Prochaine séance = première PLANNED, dans l'ordre semaine puis orderInWeek (les dates ne sont que suggérées). */
export const nextPlanned = (programId: string) =>
  prisma.plannedSession.findFirst({ where: { programId, status: "PLANNED" }, orderBy: [{ week: { number: "asc" } }, { orderInWeek: "asc" }] });

/** Plus aucune séance à faire : le programme est terminé. */
export async function finishIfDone(programId: string) {
  if (await nextPlanned(programId)) return false;
  await prisma.program.updateMany({ where: { id: programId, status: "ACTIVE" }, data: { status: "COMPLETED", completedAt: new Date() } });
  return true;
}

/** Inverse de finishIfDone : une séance redevient à faire (activité supprimée) → le programme terminé reprend, sauf si un autre programme du même sport l'a remplacé. */
export async function reopenIfNeeded(programId: string) {
  const p = await prisma.program.findUnique({ where: { id: programId }, select: { userId: true, sport: true, status: true } });
  if (p?.status !== "COMPLETED" || !(await nextPlanned(programId))) return false;
  if (await prisma.program.count({ where: { userId: p.userId, sport: p.sport, status: { in: ["ACTIVE", "PAUSED"] }, id: { not: programId } } })) return false;
  await prisma.program.update({ where: { id: programId }, data: { status: "ACTIVE", completedAt: null } });
  return true;
}

const compliance =(actualS: number, plannedS: number | null) => (plannedS ? Math.min(100, Math.round((actualS / plannedS) * 100)) : null);

/**
 * Liaison automatique après l'import d'une sortie RUN : rattachée à la prochaine séance du programme RUN actif.
 * Si une séance a été cochée « faite » à la main le même jour sans sortie, l'activité vient la compléter au lieu
 * de consommer la suivante. Une activité n'est jamais reliée deux fois (completedActivityId est unique).
 * Les sorties antérieures au jour d'activation du programme (import d'historique) ne sont pas reliées.
 */
export async function linkActivityToPlannedSession(a: { id: string; userId: string; type: string; startedAt: Date; movingTimeS: number }) {
  if (a.type !== "RUN" || a.movingTimeS < MIN_LINK_S) return null;
  if (await prisma.plannedSession.findUnique({ where: { completedActivityId: a.id }, select: { id: true } })) return null;
  const p = await prisma.program.findFirst({ where: { userId: a.userId, sport: "RUN", status: "ACTIVE" }, orderBy: { activatedAt: "desc" }, select: { id: true, activatedAt: true } });
  if (!p || (p.activatedAt && dayKey(a.startedAt, TZ) < dayKey(p.activatedAt, TZ))) return null;

  const key = dayKey(a.startedAt, TZ);
  const manual = (await prisma.plannedSession.findMany({
    where: { programId: p.id, status: "COMPLETED", completedActivityId: null, completedAt: { gte: new Date(+a.startedAt - 2 * 864e5), lte: new Date(+a.startedAt + 2 * 864e5) } },
    select: { id: true, completedAt: true, plannedDurationS: true },
  })).find((s) => s.completedAt && dayKey(s.completedAt, TZ) === key);

  // Deux essais : un import concurrent a pu prendre la même séance entre-temps.
  for (let attempt = 0; attempt < 2; attempt++) {
    const target = manual && attempt === 0 ? manual : await nextPlanned(p.id);
    if (!target) return null;
    try {
      const res = await prisma.plannedSession.updateMany({
        where: { id: target.id, completedActivityId: null, status: manual && attempt === 0 ? "COMPLETED" : "PLANNED" },
        data: { status: "COMPLETED", completedActivityId: a.id, complianceScore: compliance(a.movingTimeS, target.plannedDurationS), completedAt: a.startedAt },
      });
      if (res.count) { await finishIfDone(p.id); refresh(); return target.id; }
    } catch (e) { console.error("[training] liaison impossible", a.id, e); return null; }
  }
  return null;
}

// ───────── Lecture : carte Home et page programme ─────────
export type SessionView = {
  id: string; weekNumber: number; orderInWeek: number; kind: SessionKind; title: string; description: string | null; summary: string;
  durationS: number; isKeySession: boolean; status: SessionStatus; date: string; isNext: boolean; complianceScore: number | null;
  activityId: string | null; steps: ReturnType<typeof resolveSteps>;
};
export type WeekView = { number: number; block: number; weekInBlock: number; phaseName: string; isRecovery: boolean; note: string | null; startDate: string; sessions: SessionView[] };
export type RunProgramView = {
  id: string; name: string; status: "ACTIVE" | "PAUSED"; totalWeeks: number; sessionsPerWeek: number; blockWeeks: number;
  current: { number: number; block: number; weekInBlock: number; phaseName: string; phaseFocus: string | null; isRecovery: boolean };
  weekDone: number; next: SessionView | null; weeks: WeekView[]; doneCount: number; totalCount: number;
  vma: { vmaKmh: number; label: string; measuredAt: string | null };
  pendingTest: { sessionId: string } | null;
  /** Dernier envoi réussi vers le calendrier Intervals.icu (séances à faire), ISO ; null = jamais envoyé. */
  intervalsSyncedAt: string | null;
};

/** Programme RUN actif (ou en pause), avec allures recalculées à partir de la VMA du moment. Null s'il n'y en a pas. */
export async function getRunProgram(userId: string, now = new Date()): Promise<RunProgramView | null> {
  const p = await prisma.program.findFirst({
    where: { userId, sport: "RUN", status: LIVE }, orderBy: { createdAt: "desc" },
    include: { phases: { orderBy: { order: "asc" } }, weeks: { orderBy: { number: "asc" }, include: { sessions: { orderBy: { orderInWeek: "asc" } } } } },
  });
  if (!p) return null;
  const keys = weekKeys(now, TZ), keySet = new Set(keys);
  const [current, runs, lastTest] = await Promise.all([
    getCurrentVma(userId),
    prisma.activity.findMany({ where: { userId, type: "RUN", startedAt: { gte: new Date(+now - 8 * 864e5) } }, select: { startedAt: true } }),
    prisma.athleteMetric.findFirst({ where: { userId, type: "VMA_KMH", source: "TEST" }, orderBy: { measuredAt: "desc" }, select: { measuredAt: true } }),
  ]);
  const vmaKmh = current?.vmaKmh ?? (p.generatorInput as RunGeneratorInput | null)?.vmaKmh ?? DEFAULT_VMA.vmaKmh;

  const flat = p.weeks.flatMap((w) => w.sessions.map((s) => ({ s, w })));
  const nextId = flat.find(({ s }) => s.status === "PLANNED")?.s.id ?? null;
  const view = (s: (typeof flat)[number]["s"], weekNumber: number): SessionView => {
    const st = s.structure as RunWorkoutStructure | null;
    return {
      id: s.id, weekNumber, orderInWeek: s.orderInWeek, kind: s.kind, title: s.title, description: s.description, isKeySession: s.isKeySession,
      summary: st ? summarizeRun(st, vmaKmh) : "", durationS: st ? estimateRun(st, vmaKmh).durationS : s.plannedDurationS ?? 0,
      status: s.status, date: s.date.toISOString().slice(0, 10), isNext: s.id === nextId, complianceScore: s.complianceScore,
      activityId: s.completedActivityId, steps: st ? resolveSteps(st, vmaKmh) : [],
    };
  };
  const phaseOf = new Map(p.phases.map((ph) => [ph.id, ph]));
  const weeks: WeekView[] = p.weeks.map((w) => ({
    number: w.number, block: blockOf(w.number), weekInBlock: weekInBlock(w.number), phaseName: phaseOf.get(w.phaseId)?.name ?? "", isRecovery: w.isRecovery,
    note: w.note, startDate: w.startDate.toISOString().slice(0, 10), sessions: w.sessions.map((s) => view(s, w.number)),
  }));
  const next = weeks.flatMap((w) => w.sessions).find((s) => s.isNext) ?? null;
  const cw = p.weeks.find((w) => w.number === (next?.weekNumber ?? p.totalWeeks)) ?? p.weeks.at(-1)!, phase = phaseOf.get(cw.phaseId);

  // Cette semaine calendaire (lundi → dimanche, Paris) : sorties RUN + séances cochées à la main sans sortie.
  const manual = flat.filter(({ s }) => s.status === "COMPLETED" && !s.completedActivityId && s.completedAt && keySet.has(dayKey(s.completedAt, TZ))).length;
  const weekDone = runs.filter((r) => keySet.has(dayKey(r.startedAt, TZ))).length + manual;

  // Test VMA terminé récemment sans distance saisie depuis.
  const test = flat.map(({ s }) => s).filter((s) => s.kind === "VMA_TEST" && s.status === "COMPLETED" && s.completedAt && +now - +s.completedAt < TEST_PROMPT_DAYS * 864e5)
    .find((s) => !lastTest || +lastTest.measuredAt < +s.completedAt!);

  const syncedAt = Math.max(0, ...flat.filter(({ s }) => s.status === "PLANNED" && s.intervalsSyncedAt).map(({ s }) => +s.intervalsSyncedAt!));

  return {
    id: p.id, name: p.name, status: p.status as "ACTIVE" | "PAUSED", totalWeeks: p.totalWeeks, sessionsPerWeek: p.sessionsPerWeek, blockWeeks: RUN_BASE_VMA.blockWeeks,
    current: { number: cw.number, block: blockOf(cw.number), weekInBlock: weekInBlock(cw.number), phaseName: phase?.name ?? "", phaseFocus: phase?.focus ?? null, isRecovery: cw.isRecovery },
    weekDone, next, weeks,
    doneCount: flat.filter(({ s }) => s.status !== "PLANNED").length, totalCount: flat.length,
    vma: { vmaKmh, label: current?.label ?? "par défaut", measuredAt: current?.measuredAt?.toISOString() ?? null },
    pendingTest: test ? { sessionId: test.id } : null,
    intervalsSyncedAt: syncedAt ? new Date(syncedAt).toISOString() : null,
  };
}
