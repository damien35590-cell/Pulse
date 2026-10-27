/**
 * Démarrer une séance de muscu sans retaper les exercices : suggestion du jour, brouillons depuis une séance passée ou un modèle,
 * enregistrement d'une séance comme modèle. Chaque fonction filtre sur l'utilisateur (userId) : jamais d'accès à la séance d'un autre.
 */
import { prisma } from "../prisma";
import { daysAgo } from "../exercises";
import { doneSets, sumReps } from "../analytics/strength";
import { BUILT_IN, builtInStructure, ensureBuiltInTemplates } from "./builtin";
import { DEFAULT_REPS, REST_BETWEEN_S, resolveName, restAfterFor, isLafayCode, DEFAULT_SETS } from "./catalog";
import { planExercise, type Structure } from "./draft";
import { historyKey, loadHistory, toRow } from "./history";
import { KIND_TITLE, kindOfNames, nextKind } from "./kind";
import type { Draft, DraftExercise, Kind, RecentSession, StartOptions, Suggestion, TemplateItem } from "./types";

type History = Awaited<ReturnType<typeof loadHistory>>;
const plan = (s: Structure, h: History) => planExercise(s, h.get(historyKey(s.code, s.variant)) ?? []);
/** Un même exercice ne figure qu'une fois dans un brouillon (B1 puis B2 dans la même séance → un seul bloc ; A2 et A3, deux échelles, restent deux blocs). */
const unique = (list: DraftExercise[]) => list.filter((e, i) => list.findIndex((x) => historyKey(x.code, x.variant) === historyKey(e.code, e.variant)) === i);

/** Ligne d'exercice enregistrée → structure : le prévu (séries, reps visées, repos), pas le réalisé. */
function structureOf(e: { name: string; sets: number; reps: number; loadKg: number | null; restS: number | null }): Structure {
  const { code, variant } = resolveName(e.name);
  const restSec = e.restS ?? (isLafayCode(code) ? REST_BETWEEN_S : 90);
  return { code, variant, sets: e.sets, reps: e.reps, restSec, restAfterSec: restAfterFor(restSec), loadKg: e.loadKg, note: null };
}

/** Séance déjà faite → brouillon : mêmes exercices dans le même ordre, mais cibles recalculées d'après la dernière fois. */
export async function buildDraftFromSession(sessionId: string, userId: string): Promise<Draft | null> {
  const a = await prisma.activity.findFirst({
    where: { id: sessionId, userId, type: "WORKOUT" },
    select: { title: true, kind: true, exercises: { orderBy: { position: "asc" }, select: { name: true, sets: true, reps: true, loadKg: true, restS: true } } },
  });
  if (!a?.exercises.length) return null;
  const kind: Kind = a.kind ?? kindOfNames(a.exercises.map((e) => e.name));
  const history = await loadHistory(userId);
  return { title: kind === "LIBRE" ? a.title : KIND_TITLE[kind], kind, templateId: null, exercises: unique(a.exercises.map((e) => plan(structureOf(e), history))) };
}

export async function buildDraftFromTemplate(templateId: string, userId: string): Promise<Draft | null> {
  const t = await prisma.workoutTemplate.findFirst({ where: { id: templateId, userId }, include: { exercises: { orderBy: { order: "asc" } } } });
  if (!t) return null;
  const history = await loadHistory(userId);
  const exercises = t.exercises.map((e) => plan({ code: e.exerciseCode, variant: e.variant, sets: e.sets, reps: e.targetReps, restSec: e.restSec, restAfterSec: e.restAfterSec, loadKg: e.loadKg, note: e.note }, history));
  return { title: t.name, kind: t.kind, templateId: t.id, exercises: unique(exercises) };
}

/** Séances de muscu récentes (la plus récente d'abord), avec leur type et leur total de répétitions. */
export async function recentSessions(userId: string, take: number): Promise<RecentSession[]> {
  const list = await prisma.activity.findMany({
    where: { userId, type: "WORKOUT", exercises: { some: {} } },
    orderBy: { startedAt: "desc" },
    take,
    select: { id: true, title: true, kind: true, startedAt: true, exercises: { select: { name: true, sets: true, reps: true, loadKg: true, setsDetail: true, activityId: true } } },
  });
  return list.map((a) => ({
    id: a.id, title: a.title, kind: a.kind ?? kindOfNames(a.exercises.map((e) => e.name)), date: a.startedAt.toISOString(),
    totalReps: sumReps(a.exercises.flatMap((e) => doneSets(toRow(e, a.startedAt)))), exercises: a.exercises.length,
  }));
}

/** Brouillon d'un modèle intégré calculé sans passer par la base (si le modèle n'existe pas, par exemple nom déjà pris). */
async function builtInDraft(kind: "HAUT" | "BAS", userId: string): Promise<Draft> {
  const b = BUILT_IN.find((x) => x.kind === kind)!, history = await loadHistory(userId);
  return { title: b.name, kind, templateId: null, exercises: builtInStructure(b.codes, history).map((s) => plan(s, history)) };
}

/**
 * Alternance haut / bas d'après la dernière séance de l'un ou l'autre type. La séance proposée est le modèle intégré de ce type
 * (la séance complète du coach), avec des cibles calculées d'après ton historique : une ancienne séance partielle ne l'appauvrit pas.
 */
export async function getNextSessionSuggestion(userId: string, known?: RecentSession[]): Promise<Suggestion> {
  const recent = known ?? (await recentSessions(userId, 40));
  const last = recent.find((r) => r.kind !== "LIBRE") ?? null;
  const kind = nextKind(last?.kind ?? null);
  await ensureBuiltInTemplates(userId);
  const t = await prisma.workoutTemplate.findFirst({ where: { userId, isBuiltIn: true, kind }, select: { id: true } });
  const draft = (t ? await buildDraftFromTemplate(t.id, userId) : null) ?? (await builtInDraft(kind, userId));
  const reason = last ? `Dernière séance : ${KIND_TITLE[last.kind!].toLowerCase()}, ${daysAgo(last.date)}.` : "Première séance : on commence par le haut du corps.";
  return { kind, title: KIND_TITLE[kind], reason, draft };
}

/** Tout ce que la feuille « Nouvelle séance » affiche. */
export async function getStartOptions(userId: string): Promise<StartOptions> {
  await ensureBuiltInTemplates(userId);
  const [recent, templates] = await Promise.all([
    recentSessions(userId, 40),
    prisma.workoutTemplate.findMany({ where: { userId }, orderBy: [{ isBuiltIn: "desc" }, { updatedAt: "desc" }], select: { id: true, name: true, kind: true, isBuiltIn: true, _count: { select: { exercises: true } } } }),
  ]);
  const items: TemplateItem[] = templates.map((t) => ({ id: t.id, name: t.name, kind: t.kind, isBuiltIn: t.isBuiltIn, exercises: t._count.exercises }));
  return { suggestion: await getNextSessionSuggestion(userId, recent), recent, templates: items };
}

/** Enregistre la structure d'une séance (exercices, séries, repos) comme modèle, sans ses performances. Un nom déjà pris reçoit « (2) ». */
export async function saveSessionAsTemplate(sessionId: string, userId: string, name: string): Promise<{ id: string; name: string } | null> {
  const a = await prisma.activity.findFirst({
    where: { id: sessionId, userId, type: "WORKOUT" },
    select: { title: true, kind: true, exercises: { orderBy: { position: "asc" }, select: { name: true, sets: true, reps: true, loadKg: true, restS: true } } },
  });
  if (!a?.exercises.length) return null;
  const wanted = name.trim().slice(0, 60) || a.title.slice(0, 60);
  const taken = new Set((await prisma.workoutTemplate.findMany({ where: { userId, name: { startsWith: wanted } }, select: { name: true } })).map((t) => t.name));
  let final = wanted;
  for (let n = 2; taken.has(final); n++) final = `${wanted} (${n})`;
  const structure = a.exercises.map((e) => structureOf(e));
  const t = await prisma.workoutTemplate.create({
    data: {
      userId, name: final, kind: a.kind ?? kindOfNames(a.exercises.map((e) => e.name)), isBuiltIn: false,
      exercises: { create: structure.map((s, order) => ({ order, exerciseCode: s.code, variant: s.variant, sets: s.sets, targetReps: s.reps, restSec: s.restSec, restAfterSec: s.restAfterSec, loadKg: s.loadKg, note: null })) },
    },
    select: { id: true, name: true },
  });
  return t;
}

/** Supprime un modèle perso ; les modèles intégrés ne se suppriment pas. */
export async function deleteTemplate(templateId: string, userId: string): Promise<boolean> {
  return (await prisma.workoutTemplate.deleteMany({ where: { id: templateId, userId, isBuiltIn: false } })).count > 0;
}

/** Un exercice à ajouter à un brouillon : « B2 - dips », « C », « Développé couché »… avec sa cible du jour. */
export async function draftExercise(userId: string, raw: string): Promise<DraftExercise | null> {
  const { code, variant } = resolveName(raw);
  if (!code) return null;
  const lafay = isLafayCode(code), restSec = lafay ? REST_BETWEEN_S : 90;
  const history = await loadHistory(userId);
  return plan({ code, variant, sets: lafay ? DEFAULT_SETS : 3, reps: lafay ? DEFAULT_REPS : 10, restSec, restAfterSec: restAfterFor(restSec), loadKg: null, note: null }, history);
}
