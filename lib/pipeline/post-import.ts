import type { Prisma, RecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bestEffort, type Pt } from "@/lib/geo";
import { activityStory, workoutStory } from "@/lib/insights/engine";
import type { Act, Story } from "@/lib/insights/types";
import { awardBadges } from "@/lib/data/badges";
import { refreshLoad } from "@/lib/data/load";

/** Deux activités se recouvrant sur plus de 70 % sont la même sortie, enregistrée par deux sources. */
export const OVERLAP_RATIO = 0.7;

/** Types qui n'établissent aucun record (vélotaf à assistance électrique). */
const NO_RECORD_TYPES = new Set(["EBIKE"]);

type Span = { startedAt: Date; movingTimeS: number; elapsedTimeS?: number | null };
const spanOf = (a: Span) => { const s = +a.startedAt; return [s, s + Math.max(a.movingTimeS, a.elapsedTimeS ?? 0) * 1000] as const; };

/**
 * Part de recouvrement rapportée à la PLUS LONGUE des deux activités : chacune doit couvrir au moins 70 % de l'autre.
 * Un court segment inclus dans une longue sortie ne compte donc pas comme doublon (on ne supprime rien par erreur).
 */
export function overlapRatio(a: Span, b: Span) {
  const [s1, e1] = spanOf(a), [s2, e2] = spanOf(b), longest = Math.max(e1 - s1, e2 - s2);
  return longest > 0 ? Math.max(0, Math.min(e1, e2) - Math.max(s1, s2)) / longest : 0;
}

/** Richesse comparée dans l'ordre : puissance/série 1 Hz > cardio > trace GPS > distance > saisie manuelle (exercices, notes, ressenti). */
export type Richness = { power: boolean; hr: boolean; gps: boolean; distance: boolean; manual: boolean };
const RANK: (keyof Richness)[] = ["power", "hr", "gps", "distance", "manual"];
/** > 0 si `a` est plus riche que `b`, < 0 si moins riche, 0 si égalité. */
export function compareRichness(a: Richness, b: Richness) {
  for (const k of RANK) if (a[k] !== b[k]) return a[k] ? 1 : -1;
  return 0;
}

const FULL = {
  id: true, userId: true, type: true, title: true, notes: true, feeling: true, startedAt: true, distanceM: true, movingTimeS: true, elapsedTimeS: true,
  elevationGainM: true, calories: true, avgHr: true, maxHr: true, avgPower: true, maxPower: true, polyline: true, trackPoints: true,
  startLat: true, startLng: true, source: true, weather: true, story: true, rpe: true, createdAt: true,
  stream: { select: { activityId: true } }, gear: { select: { id: true } }, _count: { select: { exercises: true } },
} satisfies Prisma.ActivitySelect;
const loadFull = (id: string) => prisma.activity.findUnique({ where: { id }, select: FULL });
type Full = NonNullable<Awaited<ReturnType<typeof loadFull>>>;

const richnessOf = (a: Full): Richness => ({
  power: !!a.stream || (a.avgPower ?? 0) > 0,
  hr: (a.avgHr ?? 0) > 0,
  gps: !!a.polyline,
  distance: a.distanceM > 0,
  manual: a._count.exercises > 0 || !!a.notes || !!a.feeling || a.rpe != null || a.source === "manual",
});

/** Activités du même utilisateur qui recouvrent la période donnée à plus de 70 %. */
export async function findOverlapping(userId: string, span: Span, excludeId?: string) {
  const [s, e] = spanOf(span);
  const near = await prisma.activity.findMany({
    where: { userId, id: excludeId ? { not: excludeId } : undefined, startedAt: { gte: new Date(s - 864e5), lt: new Date(e) } },
    select: { id: true, startedAt: true, movingTimeS: true, elapsedTimeS: true },
  });
  return near.filter((o) => overlapRatio(o, span) > OVERLAP_RATIO);
}

/** Copie dans `keep` ce qui lui manque et que `drop` possède, rattache série, exercices, photos, matériel et records, puis supprime `drop`. */
async function mergeInto(keep: Full, drop: Full) {
  const fill = <K extends "notes" | "feeling" | "rpe" | "elapsedTimeS" | "calories" | "avgHr" | "maxHr" | "avgPower" | "maxPower" | "polyline" | "startLat" | "startLng" | "story">(k: K) =>
    keep[k] == null && drop[k] != null ? drop[k] : undefined;
  const json = (k: "trackPoints" | "weather") => (keep[k] == null && drop[k] != null ? (drop[k] as Prisma.InputJsonValue) : undefined);
  const data: Prisma.ActivityUpdateInput = {
    notes: fill("notes"), feeling: fill("feeling"), rpe: fill("rpe"), elapsedTimeS: fill("elapsedTimeS"), calories: fill("calories"),
    avgHr: fill("avgHr"), maxHr: fill("maxHr"), avgPower: fill("avgPower"), maxPower: fill("maxPower"),
    polyline: fill("polyline"), startLat: fill("startLat"), startLng: fill("startLng"), story: fill("story"),
    trackPoints: json("trackPoints"), weather: json("weather"),
    distanceM: keep.distanceM <= 0 && drop.distanceM > 0 ? drop.distanceM : undefined,
    elevationGainM: keep.elevationGainM <= 0 && drop.elevationGainM > 0 ? drop.elevationGainM : undefined,
    gear: drop.gear.length ? { connect: drop.gear.map((g) => ({ id: g.id })) } : undefined,
  };
  await prisma.$transaction([
    ...(keep.stream || !drop.stream ? [] : [prisma.activityStream.update({ where: { activityId: drop.id }, data: { activityId: keep.id } })]),
    prisma.workoutExercise.updateMany({ where: { activityId: drop.id }, data: { activityId: keep.id } }),
    prisma.activityPhoto.updateMany({ where: { activityId: drop.id }, data: { activityId: keep.id } }),
    prisma.personalRecord.updateMany({ where: { userId: keep.userId, activityId: drop.id }, data: { activityId: keep.id } }),
    prisma.activity.update({ where: { id: keep.id }, data }),
    prisma.activity.delete({ where: { id: drop.id } }),
  ]);
}

/** Étape a : fusionne les doublons. Renvoie l'id de l'activité conservée (celle-ci ou une autre plus riche) et les ids supprimés. */
async function dedupe(id: string) {
  let keep = await loadFull(id);
  const removed: string[] = [];
  if (!keep) return { keptId: null as string | null, removed };
  for (const o of await findOverlapping(keep.userId, keep, keep.id)) {
    const other = await loadFull(o.id);
    if (!other) continue;
    // La plus riche reste ; à égalité, la plus ancienne en base (elle porte peut-être des retouches).
    const c = compareRichness(richnessOf(keep), richnessOf(other));
    const keepCurrent = c > 0 || (c === 0 && +keep.createdAt <= +other.createdAt);
    const [k, d] = keepCurrent ? [keep, other] : [other, keep];
    await mergeInto(k, d);
    removed.push(d.id);
    keep = await loadFull(k.id);
    if (!keep) break;
  }
  return { keptId: keep?.id ?? null, removed };
}

const toPts = (raw: unknown): Pt[] =>
  Array.isArray(raw)
    ? (raw as { lat?: number; lng?: number; t?: number }[]).filter((p) => p && p.lat != null && p.lng != null && p.t != null).map((p) => ({ lat: p.lat!, lng: p.lng!, t: p.t! }))
    : [];

export type RecordUpdate = { kind: RecordKind; value: number; beaten: boolean; label?: string };

/** Étape b : records de cette activité (meilleurs temps en course, plus longue distance/durée et plus gros D+ par sport ; jamais pour un E-bike). */
async function updateRecords(a: Full, points?: Pt[]): Promise<RecordUpdate[]> {
  if (NO_RECORD_TYPES.has(a.type)) return [];
  const cands: { kind: RecordKind; value: number | null; lower: boolean; label?: string }[] = [];
  if (a.type === "RUN") {
    const pts = points?.length ? points : toPts(a.trackPoints);
    for (const [kind, label, m] of [["BEST_10K", "10 km", 10000], ["BEST_5K", "5 km", 5000], ["BEST_HALF", "semi-marathon", 21097.5]] as const)
      cands.push({ kind, label, value: bestEffort(pts, m), lower: true });
  }
  if (a.distanceM > 0) cands.push({ kind: "LONGEST_DISTANCE", value: a.distanceM, lower: false });
  if (a.movingTimeS > 0) cands.push({ kind: "LONGEST_TIME", value: a.movingTimeS, lower: false });
  if (a.elevationGainM > 0) cands.push({ kind: "BEST_ELEVATION", value: a.elevationGainM, lower: false });

  const out: RecordUpdate[] = [];
  for (const c of cands) {
    if (c.value == null) continue;
    const key = { userId_kind_type: { userId: a.userId, kind: c.kind, type: a.type } };
    const old = await prisma.personalRecord.findUnique({ where: key });
    if (old && (c.lower ? c.value >= old.value : c.value <= old.value)) continue;
    await prisma.personalRecord.upsert({
      where: key,
      update: { value: c.value, achievedAt: a.startedAt, activityId: a.id },
      create: { userId: a.userId, kind: c.kind, type: a.type, value: c.value, achievedAt: a.startedAt, activityId: a.id },
    });
    out.push({ kind: c.kind, value: c.value, beaten: !!old, label: c.label });
  }
  return out;
}

/** Étape d : anecdote, seulement si l'activité n'en a pas encore. */
async function writeStory(a: Full, records: RecordUpdate[]): Promise<Story | null> {
  if (a.story) return null;
  const self: Act = {
    id: `${a.userId}-${+a.startedAt}`, type: a.type, startedAt: a.startedAt, distanceM: a.distanceM, movingTimeS: a.movingTimeS,
    elevationGainM: a.elevationGainM, startLat: a.startLat, startLng: a.startLng, weather: a.weather as Act["weather"],
  };
  let story: Story;
  if (a.type === "WORKOUT" && a._count.exercises > 0) {
    const ex = await prisma.workoutExercise.findMany({ where: { activityId: a.id }, select: { sets: true, reps: true, loadKg: true } });
    story = workoutStory({ volumeKg: ex.reduce((s, e) => s + e.sets * e.reps * (e.loadKg ?? 0), 0), exercises: ex.length, sets: ex.reduce((s, e) => s + e.sets, 0) }, self.id);
  } else {
    const [user, hist, life] = await Promise.all([
      prisma.user.findUnique({ where: { id: a.userId }, select: { timezone: true } }),
      prisma.activity.findMany({ where: { userId: a.userId, id: { not: a.id }, startedAt: { gte: new Date(+a.startedAt - 30 * 864e5), lt: a.startedAt } }, select: { id: true, type: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true } }),
      prisma.activity.aggregate({ where: { userId: a.userId, startedAt: { lt: a.startedAt } }, _sum: { distanceM: true } }),
    ]);
    // On n'annonce un record que s'il y avait un ancien temps à battre (10 km d'abord, puis 5 km, puis semi).
    const pr = records.find((r) => r.beaten && r.label);
    story = activityStory(self, hist, { tz: user?.timezone ?? "Europe/Paris", lifetimeKmBefore: (life._sum.distanceM ?? 0) / 1000, pr: pr?.label ? { label: pr.label } : null });
  }
  await prisma.activity.update({ where: { id: a.id }, data: { story: story.text } });
  return story;
}

export type ProcessResult = {
  /** Activité conservée : celle passée en paramètre, ou l'activité plus riche dans laquelle elle a été fusionnée (null si introuvable). */
  activityId: string | null;
  removed: string[];
  records: RecordUpdate[];
  badges: number;
  story: Story | null;
  errors: string[];
};

/**
 * Traitement commun après chaque création d'activité, quelle que soit la source : doublons, charge d'entraînement, records, badges, anecdote.
 * Chaque étape est isolée : une erreur est journalisée et renvoyée, jamais levée, pour ne pas bloquer l'import.
 * `hint.points` : trace complète si l'appelant l'a encore en mémoire (plus précise pour les records que la trace compactée en base).
 */
export async function processActivity(activityId: string, hint?: { points?: Pt[] }): Promise<ProcessResult> {
  const res: ProcessResult = { activityId, removed: [], records: [], badges: 0, story: null, errors: [] };
  const fail = (step: string, e: unknown) => {
    const m = `${step} : ${e instanceof Error ? e.message : String(e)}`;
    console.error(`[post-import] ${activityId} ${m}`);
    res.errors.push(m);
  };

  try { const d = await dedupe(activityId); res.activityId = d.keptId; res.removed = d.removed; }
  catch (e) { fail("doublons", e); }
  if (!res.activityId) return res;

  let a: Full | null = null;
  try { a = await loadFull(res.activityId); } catch (e) { fail("lecture", e); }
  if (!a) return res;

  // Après la fusion : l'activité conservée a pu récupérer une série, une FC ou un ressenti.
  try { await refreshLoad(a.id); }
  catch (e) { fail("charge", e); }

  try { res.records = await updateRecords(a, res.activityId === activityId ? hint?.points : undefined); }
  catch (e) { fail("records", e); }

  try {
    const user = await prisma.user.findUnique({ where: { id: a.userId }, select: { timezone: true } });
    res.badges = await awardBadges(a.userId, user?.timezone ?? "Europe/Paris");
  } catch (e) { fail("badges", e); }

  try { res.story = await writeStory(a, res.records); }
  catch (e) { fail("anecdote", e); }

  return res;
}
