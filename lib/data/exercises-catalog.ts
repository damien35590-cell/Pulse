/**
 * Table Exercise ↔ catalogue du code, et rapprochement des noms libres de WorkoutExercise.
 * La base n'est accessible qu'en production : la synchro se fait depuis l'app (auto ou bouton), jamais par script.
 */
import type { Equipment, LoadType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { exerciseKey } from "@/lib/exercises";
import { EXERCISE_CATALOG } from "@/lib/training/catalog/exercises";
import { buildMatcher } from "@/lib/training/match-exercise";

const SLUGS = EXERCISE_CATALOG.map((e) => e.slug);

/** Upsert par slug de tout le catalogue (les exercices perso ne sont jamais touchés), puis liens vers la variante plus dure. Idempotente. */
export async function ensureExerciseCatalog(): Promise<{ count: number }> {
  const custom = new Set((await prisma.exercise.findMany({ where: { slug: { in: SLUGS }, isCustom: true }, select: { slug: true } })).map((e) => e.slug));
  const list = EXERCISE_CATALOG.filter((e) => !custom.has(e.slug));
  await prisma.$transaction(list.map((e) => {
    const data = {
      name: e.name, aliases: e.aliases ?? [], equipment: e.equipment, loadType: e.loadType, mechanic: e.mechanic ?? null,
      primaryMuscles: e.primaryMuscles, secondaryMuscles: e.secondaryMuscles ?? [], difficulty: e.difficulty ?? null, instructions: e.instructions ?? null,
    };
    return prisma.exercise.upsert({ where: { slug: e.slug }, create: { slug: e.slug, ...data }, update: data });
  }));
  const ids = new Map((await prisma.exercise.findMany({ where: { slug: { in: SLUGS }, isCustom: false }, select: { id: true, slug: true } })).map((e) => [e.slug, e.id]));
  await prisma.$transaction(list.map((e) => prisma.exercise.update({
    where: { slug: e.slug }, data: { harderVariantId: (e.harderVariantSlug && ids.get(e.harderVariantSlug)) || null },
  })));
  return { count: list.length };
}

let synced: Promise<void> | null = null;
/** Une fois par instance : synchronise si le nombre d'exercices du catalogue présents en base diffère du catalogue. */
export function autoSyncExerciseCatalog(): Promise<void> {
  synced ??= (async () => {
    const n = await prisma.exercise.count({ where: { isCustom: false, slug: { in: SLUGS } } });
    if (n !== SLUGS.length) await ensureExerciseCatalog();
  })().catch((e) => { synced = null; console.error("[exercises] synchro du catalogue", e); });
  return synced;
}

// ───────── Rapprochement ─────────

export type ExerciseOption = { id: string; slug: string; name: string; aliases: string[]; equipment: Equipment; loadType: LoadType; isCustom: boolean; difficulty: number | null };
const optionSelect = { id: true, slug: true, name: true, aliases: true, equipment: true, loadType: true, isCustom: true, difficulty: true } as const;

/** Exercices visibles par l'utilisateur : le catalogue et ses exercices perso (ceux rattachés à ses séances). */
export const userExercises = (userId: string): Promise<ExerciseOption[]> => prisma.exercise.findMany({
  where: { OR: [{ isCustom: false }, { isCustom: true, logs: { some: { activity: { userId } } } }] },
  select: optionSelect, orderBy: { name: "asc" },
});

/**
 * Rapprochement pour un utilisateur. Une correspondance exacte vient :
 *  1. de son propre historique (un nom qu'il a déjà rattaché, à la main ou automatiquement) ;
 *  2. sinon du nom ou d'un alias d'un exercice (catalogue ou perso), propre à un seul exercice.
 */
async function matchContext(userId: string) {
  const [options, linked] = await Promise.all([
    userExercises(userId),
    prisma.workoutExercise.findMany({ where: { exerciseId: { not: null }, activity: { userId } }, distinct: ["name", "exerciseId"], select: { name: true, exerciseId: true } }),
  ]);
  const byId = new Map(options.map((o) => [o.id, o]));
  const mine = new Map<string, Set<string>>();
  for (const r of linked) {
    const k = exerciseKey(r.name);
    if (k && r.exerciseId && byId.has(r.exerciseId)) (mine.get(k) ?? mine.set(k, new Set()).get(k)!).add(r.exerciseId);
  }
  const match = buildMatcher(options);
  return {
    options,
    match(name: string): { option: ExerciseOption; exact: boolean } | null {
      const ids = mine.get(exerciseKey(name));
      if (ids?.size === 1) return { option: byId.get([...ids][0])!, exact: true };
      const m = match(name);
      return m && { option: m.entry, exact: m.exact };
    },
  };
}

/** À l'enregistrement d'une séance : exerciseId de chaque nom quand la correspondance est exacte. */
export async function exactExerciseIds(userId: string, names: string[]): Promise<Map<string, string>> {
  await autoSyncExerciseCatalog();
  const ctx = await matchContext(userId), out = new Map<string, string>();
  for (const n of names) { const m = ctx.match(n); if (m?.exact) out.set(n, m.option.id); }
  return out;
}

/** Noms distincts des lignes non rattachées, regroupés par clé (« Pompes » = « pompe »). */
async function unlinkedGroups(userId: string) {
  const rows = await prisma.workoutExercise.findMany({
    where: { exerciseId: null, activity: { userId } },
    select: { name: true, activityId: true, activity: { select: { startedAt: true } } },
  });
  const by = new Map<string, { key: string; spell: Map<string, number>; activities: Set<string>; last: Date }>();
  for (const r of rows) {
    const key = exerciseKey(r.name);
    if (!key) continue;
    let g = by.get(key);
    if (!g) by.set(key, g = { key, spell: new Map(), activities: new Set(), last: r.activity.startedAt });
    g.spell.set(r.name, (g.spell.get(r.name) ?? 0) + 1);
    g.activities.add(r.activityId);
    if (r.activity.startedAt > g.last) g.last = r.activity.startedAt;
  }
  return [...by.values()];
}

export type CatalogSyncResult = { catalog: number; linked: number; linkedRows: number; toReview: number };

/** Rattrapage de l'historique : rattache les noms dont la correspondance est exacte, compte ceux qui restent à vérifier. */
export async function backfillExerciseLinks(userId: string): Promise<Omit<CatalogSyncResult, "catalog">> {
  const [groups, ctx] = await Promise.all([unlinkedGroups(userId), matchContext(userId)]);
  let linked = 0, linkedRows = 0;
  for (const g of groups) {
    const m = ctx.match([...g.spell.keys()][0]); // un vrai nom : exerciseKey n'est pas idempotente (« stress »)
    if (!m?.exact) continue;
    const r = await prisma.workoutExercise.updateMany({ where: { exerciseId: null, name: { in: [...g.spell.keys()] }, activity: { userId } }, data: { exerciseId: m.option.id } });
    linked++; linkedRows += r.count;
  }
  return { linked, linkedRows, toReview: groups.length - linked };
}

/** Bouton « Mettre à jour le catalogue » : synchro complète puis rattrapage. */
export async function syncCatalogAndHistory(userId: string): Promise<CatalogSyncResult> {
  const { count } = await ensureExerciseCatalog();
  return { catalog: count, ...(await backfillExerciseLinks(userId)) };
}

export type UnlinkedName = { key: string; name: string; spellings: string[]; sessions: number; lastAt: string; suggestion: { id: string; name: string } | null };

/** Page /plan/exercices : mes noms encore non rattachés, les plus fréquents d'abord, avec une suggestion éventuelle. */
export async function getUnlinkedNames(userId: string): Promise<UnlinkedName[]> {
  const [groups, ctx] = await Promise.all([unlinkedGroups(userId), matchContext(userId)]);
  return groups.map((g) => {
    const spellings = [...g.spell.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    const m = ctx.match(spellings[0]);
    return { key: g.key, name: spellings[0].trim(), spellings, sessions: g.activities.size, lastAt: g.last.toISOString(), suggestion: m && { id: m.option.id, name: m.option.name } };
  }).sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, "fr"));
}

/** Compteurs de la section Muscu de /plan. */
export async function getExerciseLinkStats(userId: string) {
  const [groups, linkedRows] = await Promise.all([
    unlinkedGroups(userId),
    prisma.workoutExercise.count({ where: { exerciseId: { not: null }, activity: { userId } } }),
  ]);
  return { toReview: groups.length, linkedRows };
}

const namesOfKey = async (userId: string, key: string) =>
  (await prisma.workoutExercise.findMany({ where: { activity: { userId } }, distinct: ["name"], select: { name: true } })).map((r) => r.name).filter((n) => exerciseKey(n) === key);

/** Rattache toutes mes lignes portant ce nom (toutes orthographes de la même clé) à un exercice. Renvoie le nombre de lignes. */
export async function linkExerciseName(userId: string, key: string, exerciseId: string, names?: string[]): Promise<number> {
  names ??= await namesOfKey(userId, key);
  if (!names.length) return 0;
  return (await prisma.workoutExercise.updateMany({ where: { name: { in: names }, activity: { userId } }, data: { exerciseId } })).count;
}

/** Un exercice perso n'a pas de propriétaire en base : il est à moi s'il est rattaché à une de mes séances. */
export const canUseExercise = async (userId: string, exerciseId: string) =>
  (await prisma.exercise.count({ where: { id: exerciseId, OR: [{ isCustom: false }, { logs: { some: { activity: { userId } } } }] } })) > 0;

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "exercice";

/** Exercice perso (hors catalogue), aussitôt rattaché aux lignes portant ce nom. */
export async function createCustomExercise(userId: string, key: string, o: { name: string; equipment: Equipment; loadType: LoadType }) {
  const names = await namesOfKey(userId, key);
  if (!names.length) return null; // sans ligne à rattacher, l'exercice resterait orphelin
  const ex = await prisma.exercise.create({
    data: { slug: `perso-${slugify(o.name)}-${Date.now().toString(36)}`, name: o.name, equipment: o.equipment, loadType: o.loadType, isCustom: true, primaryMuscles: [], secondaryMuscles: [] },
    select: { id: true, slug: true },
  });
  await linkExerciseName(userId, key, ex.id, names);
  return ex;
}
