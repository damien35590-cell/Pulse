import type { ActivityType, Prisma, RecordKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bestEffort, type Pt } from "@/lib/geo";
import { storyForActivity } from "@/lib/coach/story";
import type { Story } from "@/lib/insights/types";
import { awardBadges } from "@/lib/data/badges";
import { refreshLoad } from "@/lib/data/load";
import { refreshZoneRibbon } from "@/lib/data/zone-ribbon";
import { linkActivityToPlannedSession } from "@/lib/data/training";

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
  // Séance de programme réalisée par `drop` : elle passe à `keep` (sinon la fusion consommerait une seconde séance).
  const keepLinked = await prisma.plannedSession.count({ where: { completedActivityId: keep.id } });
  await prisma.$transaction([
    ...(keepLinked ? [] : [prisma.plannedSession.updateMany({ where: { completedActivityId: drop.id }, data: { completedActivityId: keep.id } })]),
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

/** Étape d : anecdote de l'activité (lib/coach/story.ts : record > série > écart à la moyenne 30 jours), seulement si elle n'en a pas encore. Aucune anecdote pour les activités douces ni quand rien n'est notable. */
async function writeStory(a: Full, records: RecordUpdate[]): Promise<Story | null> {
  if (a.story) return null;
  const c = await storyForActivity(a.id, records);
  if (!c) return null;
  await prisma.activity.update({ where: { id: a.id }, data: { story: c.text } });
  return { tag: c.kind, text: c.text };
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
 * Traitement commun après chaque création d'activité, quelle que soit la source : doublons, charge d'entraînement, records, badges, anecdote,
 * puis liaison à la prochaine séance du programme RUN actif, puis commentaire de séance (qui s'appuie sur cette liaison).
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

  // Ruban de zones de la liste d'activités : calculé une fois la série finale connue (fusion comprise).
  try { await refreshZoneRibbon(a.id); }
  catch (e) { fail("ruban", e); }

  try { res.records = await updateRecords(a, res.activityId === activityId ? hint?.points : undefined); }
  catch (e) { fail("records", e); }

  try {
    const user = await prisma.user.findUnique({ where: { id: a.userId }, select: { timezone: true } });
    res.badges = await awardBadges(a.userId, user?.timezone ?? "Europe/Paris");
  } catch (e) { fail("badges", e); }

  try { await linkActivityToPlannedSession(a); }
  catch (e) { fail("programme", e); }

  // Après la liaison au programme : le verdict compare la sortie à la cible de la séance prévue.
  try { res.story = await writeStory(a, res.records); }
  catch (e) { fail("anecdote", e); }

  return res;
}

const EFFORT_M: Partial<Record<RecordKind, number>> = { BEST_5K: 5000, BEST_10K: 10000, BEST_HALF: 21097.5 };

/** Après suppression d'une activité : recalcule, à partir des sorties restantes, les records qu'elle détenait (ou les retire). */
export async function recomputeRecords(userId: string, held: { kind: RecordKind; type: ActivityType }[]) {
  for (const { kind, type } of held) {
    let best: { value: number; at: Date; id: string } | null = null;
    const m = EFFORT_M[kind];
    if (m) {
      // Meilleur temps sur la distance : on relit les traces par paquets pour ne pas tout charger d'un coup.
      for (let cursor: string | undefined; ;) {
        const runs = await prisma.activity.findMany({
          where: { userId, type, distanceM: { gte: m } }, orderBy: { id: "asc" }, take: 20,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), select: { id: true, startedAt: true, trackPoints: true },
        });
        for (const r of runs) { const v = bestEffort(toPts(r.trackPoints), m); if (v != null && (!best || v < best.value)) best = { value: v, at: r.startedAt, id: r.id }; }
        if (runs.length < 20) break;
        cursor = runs[runs.length - 1].id;
      }
    } else {
      const pick = (a: { distanceM: number; movingTimeS: number; elevationGainM: number }) => kind === "LONGEST_DISTANCE" ? a.distanceM : kind === "LONGEST_TIME" ? a.movingTimeS : a.elevationGainM;
      const orderBy = kind === "LONGEST_DISTANCE" ? { distanceM: "desc" as const } : kind === "LONGEST_TIME" ? { movingTimeS: "desc" as const } : { elevationGainM: "desc" as const };
      const a = await prisma.activity.findFirst({ where: { userId, type }, orderBy, select: { id: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true } });
      if (a && pick(a) > 0) best = { value: pick(a), at: a.startedAt, id: a.id };
    }
    const key = { userId_kind_type: { userId, kind, type } };
    if (best) await prisma.personalRecord.update({ where: key, data: { value: best.value, achievedAt: best.at, activityId: best.id } });
    else await prisma.personalRecord.delete({ where: key });
  }
}
