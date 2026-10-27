"use server";
import { revalidatePath } from "next/cache";
import type { ActivityType, Equipment, GearKind, GoalMetric, GoalPeriod, LoadType } from "@prisma/client";
import { GEAR_KINDS, GEAR_SPORTS, type GearKindKey } from "@/lib/gear";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AGE_BANDS } from "@/lib/bench";
import { METRICS, PERIODS } from "@/lib/goals";
import { importRaceFromUrl } from "@/lib/races/import";
import { weeklyGoalKm } from "@/lib/races/prep";
import type { RaceDraft } from "@/types/race";
import { syncProgramToIntervals } from "@/lib/sync/intervals-calendar";
import { createRunProgram, finishIfDone, reopenIfNeeded, saveVmaMetric } from "@/lib/data/training";
import { revokeLostBadges } from "@/lib/data/badges";
import { isSessionType } from "@/lib/art/session-type";
import { getZones } from "@/lib/data/zones";
import { onThresholdsChange } from "@/lib/data/zone-ribbon";
import { refreshEstimatedHrMax } from "@/lib/physio/hr-max";
import { recomputeRecords } from "@/lib/pipeline/post-import";
import { canUseExercise, createCustomExercise, linkExerciseName, syncCatalogAndHistory, type CatalogSyncResult } from "@/lib/data/exercises-catalog";
import { EQUIPMENT_LABELS, LOAD_TYPE_LABELS } from "@/lib/training/catalog/exercises";
import { DEFAULT_VMA, isValidVma, VMA_MAX, VMA_MIN, vmaFromHalfCooper } from "@/lib/training/vma";

const MY = ["RUN", "RIDE", "HIKE", "WORKOUT"];
async function uid() { const id = (await auth())?.user?.id; if (!id) throw new Error("unauthorized"); return id; }

export async function addGoal(fd: FormData) {
  const userId = await uid();
  const metric = String(fd.get("metric")), period = String(fd.get("period")), type = String(fd.get("type")), t = parseFloat(String(fd.get("target")).replace(",", "."));
  if (!(metric in METRICS) || !(period in PERIODS) || !(t > 0)) return;
  await prisma.goal.create({ data: { userId, metric: metric as GoalMetric, period: period as GoalPeriod, type: MY.includes(type) ? (type as ActivityType) : null, target: t * METRICS[metric as keyof typeof METRICS].base } });
  revalidatePath("/goals");
}
/** Valide un palier de badge gagné (retire la pastille « Nouveau »). Idempotent : sans effet s'il est déjà validé ou inconnu. */
export async function acknowledgeBadge(key: string): Promise<Res> {
  const userId = await uid();
  if (typeof key !== "string" || !/^[\w-]{1,40}:[1-9]$/.test(key)) return { ok: false, error: "Badge inconnu." };
  await prisma.userBadge.updateMany({ where: { userId, badgeId: key, acknowledgedAt: null }, data: { acknowledgedAt: new Date() } });
  revalidatePath("/"); revalidatePath("/vous"); revalidatePath("/vous/badges");
  revalidatePath("/", "layout"); // pastille de la barre du bas (layout)
  return { ok: true };
}

/** Modifie un objectif en place (mesure, sport, période, cible) : plus besoin de le retirer pour le recréer. */
export async function updateGoal(id: string, fd: FormData): Promise<Res> {
  const userId = await uid();
  const metric = String(fd.get("metric")), period = String(fd.get("period")), type = String(fd.get("type")), t = parseFloat(String(fd.get("target")).replace(",", "."));
  if (!(metric in METRICS) || !(period in PERIODS)) return { ok: false, error: "Objectif invalide." };
  if (!(t > 0)) return { ok: false, error: "Donne une cible supérieure à zéro." };
  const r = await prisma.goal.updateMany({
    where: { id, userId },
    data: { metric: metric as GoalMetric, period: period as GoalPeriod, type: MY.includes(type) ? (type as ActivityType) : null, target: t * METRICS[metric as keyof typeof METRICS].base },
  });
  if (r.count === 0) return { ok: false, error: "Objectif introuvable." };
  revalidatePath("/goals"); revalidatePath("/");
  return { ok: true };
}
export async function deleteGoal(id: string) { const userId = await uid(); await prisma.goal.deleteMany({ where: { id, userId } }); revalidatePath("/goals"); }

export async function saveProfile(fd: FormData) {
  const userId = await uid(), age = String(fd.get("age")), sex = String(fd.get("sex"));
  await prisma.user.update({ where: { id: userId }, data: { ageBand: AGE_BANDS.includes(age) ? age : null, sex: sex === "H" || sex === "F" ? sex : null } });
  revalidatePath("/bench");
}

// ───────── Programmes v2 : running « Reprise & VMA » (mode flexible) ─────────
type Res = { ok: true } | { ok: false; error: string };
const programPaths = () => { revalidatePath("/"); revalidatePath("/plan"); };
const vmaOf = (v: unknown) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Math.round(n * 10) / 10; };

/** Crée et active le programme ; l'ancien programme RUN actif est abandonné dans la même transaction. */
export async function createRunProgramAction(o: { sessionsPerWeek: number; vmaKmh: number; estimated: boolean }): Promise<Res> {
  const userId = await uid(), vma = vmaOf(o.vmaKmh), n = Number(o.sessionsPerWeek);
  if (n !== 2 && n !== 3) return { ok: false, error: "Choisis 2 ou 3 séances par semaine." };
  if (!isValidVma(vma)) return { ok: false, error: `La VMA doit être comprise entre ${VMA_MIN} et ${VMA_MAX} km/h.` };
  const estimated = !!o.estimated;
  await createRunProgram(userId, { sessionsPerWeek: n, vmaKmh: vma, vmaSource: estimated ? "ESTIMATED" : "MANUAL", vmaNote: estimated && vma === DEFAULT_VMA.vmaKmh ? DEFAULT_VMA.note : undefined });
  programPaths();
  return { ok: true };
}

/** Séance de l'utilisateur, dans un programme RUN en cours. */
const ownSession = (userId: string, id: string) =>
  prisma.plannedSession.findFirst({ where: { id, userId, program: { status: { in: ["ACTIVE", "PAUSED"] } } }, select: { id: true, programId: true, status: true } });

/** « Marquer comme faite » sans sortie liée : une sortie importée le même jour viendra la compléter. */
export async function completePlannedSession(id: string): Promise<Res> {
  const userId = await uid(), s = await ownSession(userId, id);
  if (!s) return { ok: false, error: "Séance introuvable." };
  if (s.status !== "PLANNED") return { ok: true };
  await prisma.plannedSession.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } });
  await finishIfDone(s.programId);
  programPaths();
  return { ok: true };
}

/** « Passer cette séance » : la suivante devient la prochaine, sans rien rattraper. */
export async function skipPlannedSession(id: string): Promise<Res> {
  const userId = await uid(), s = await ownSession(userId, id);
  if (!s) return { ok: false, error: "Séance introuvable." };
  if (s.status !== "PLANNED") return { ok: true };
  await prisma.plannedSession.update({ where: { id }, data: { status: "SKIPPED" } });
  await finishIfDone(s.programId);
  programPaths();
  return { ok: true };
}

/** « Envoyer sur Garmin » : séances des 14 prochains jours → calendrier Intervals.icu (→ montre). Renvoyer met à jour. */
export async function sendProgramToIntervals(): Promise<Res> {
  const userId = await uid();
  try { await syncProgramToIntervals(userId); }
  catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Envoi impossible." }; }
  programPaths();
  return { ok: true };
}

/** Pause / reprise. En pause, les sorties importées ne sont plus reliées aux séances. */
export async function toggleProgramPause(id: string): Promise<Res> {
  const userId = await uid(), p = await prisma.program.findFirst({ where: { id, userId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { status: true } });
  if (!p) return { ok: false, error: "Programme introuvable." };
  await prisma.program.update({ where: { id }, data: p.status === "ACTIVE" ? { status: "PAUSED", pausedAt: new Date() } : { status: "ACTIVE", pausedAt: null } });
  programPaths();
  return { ok: true };
}

/**
 * Interrupteur « Envoi sur Garmin » : actif = programme actif, séances des 14 prochains jours dans Intervals.icu (→ montre), mises à jour chaque nuit ;
 * éteint = programme en pause (même effet que l'ancien bouton « Mettre en pause » : plus d'envoi, les séances déjà envoyées sont retirées).
 * Le changement d'état est fait même si Intervals.icu échoue : `warning` dit alors ce qui n'est pas parti.
 */
export async function setGarminSync(id: string, on: boolean): Promise<{ ok: true; warning?: string } | { ok: false; error: string }> {
  const userId = await uid(), p = await prisma.program.findFirst({ where: { id, userId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { status: true } });
  if (!p) return { ok: false, error: "Programme introuvable." };
  if ((p.status === "ACTIVE") !== on) await prisma.program.update({ where: { id }, data: on ? { status: "ACTIVE", pausedAt: null } : { status: "PAUSED", pausedAt: new Date() } });
  programPaths();
  try { await syncProgramToIntervals(userId); }
  catch (e) { return { ok: true, warning: e instanceof Error ? e.message : "Envoi impossible." }; }
  return { ok: true };
}

/**
 * « Supprimer ce programme » : le programme RUN en cours disparaît de la page et de l'accueil (statut ABANDONED, comme lorsqu'on en recommence un).
 * Les sorties enregistrées et leurs liens avec les séances restent dans l'historique. Les séances déjà envoyées sur Garmin sont retirées (au mieux : la synchro de nuit rattrape).
 */
export async function deleteRunProgram(id: string): Promise<Res> {
  const userId = await uid(), r = await prisma.program.updateMany({ where: { id, userId, sport: "RUN", status: { in: ["ACTIVE", "PAUSED"] } }, data: { status: "ABANDONED" } });
  if (!r.count) return { ok: false, error: "Programme introuvable." };
  try { await syncProgramToIntervals(userId); } catch { /* clé absente ou Intervals injoignable : la synchro de nuit retirera les séances */ }
  programPaths();
  return { ok: true };
}

/** Résultat du demi-Cooper : VMA = distance en 6 minutes / 100. Toutes les allures suivantes se recalculent. */
export async function saveVmaTest(sessionId: string, distanceM: number): Promise<{ ok: true; vmaKmh: number } | { ok: false; error: string }> {
  const userId = await uid(), d = Math.round(Number(distanceM));
  if (!(d >= 800 && d <= 2500)) return { ok: false, error: "Entre la distance en mètres (entre 800 et 2 500 m en 6 minutes)." };
  const s = await prisma.plannedSession.findFirst({ where: { id: sessionId, userId, kind: "VMA_TEST" }, select: { completedAt: true, completedActivityId: true } });
  if (!s) return { ok: false, error: "Séance introuvable." };
  const vmaKmh = vmaFromHalfCooper(d);
  await saveVmaMetric(userId, vmaKmh, "TEST", { measuredAt: s.completedAt ?? new Date(), activityId: s.completedActivityId, note: `Demi-Cooper : ${d} m en 6 min` });
  programPaths();
  return { ok: true, vmaKmh };
}

/** « Mettre à jour ma VMA » (valeur connue, saisie à la main). */
export async function updateVma(vmaKmh: number): Promise<Res> {
  const userId = await uid(), v = vmaOf(vmaKmh);
  if (!isValidVma(v)) return { ok: false, error: `La VMA doit être comprise entre ${VMA_MIN} et ${VMA_MAX} km/h.` };
  await saveVmaMetric(userId, v, "MANUAL");
  programPaths();
  return { ok: true };
}

// ───────── Courses (la saisie manuelle passe par le formulaire d'import) ─────────
const num = (v: FormDataEntryValue | null) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

export async function deleteEvent(id: string) { const userId = await uid(); await prisma.raceEvent.deleteMany({ where: { id, userId } }); revalidatePath("/events"); revalidatePath("/"); }

// ───────── Import d'une course par lien (NextRun, Klikego…) ─────────
export type RaceImportPreview = { ok: true; event: { eventName?: string; location?: string; date?: string }; races: RaceDraft[] } | { ok: false; error: string };

export async function previewRaceImport(url: string): Promise<RaceImportPreview> {
  await uid();
  try {
    const { event, races } = await importRaceFromUrl(String(url ?? ""));
    if (races.length === 0) return { ok: false, error: "Aucune épreuve trouvée sur cette page." };
    return { ok: true, event, races };
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : "Impossible de lire cette page." };
  }
}

const PLATFORMS = ["NEXTRUN", "KLIKEGO", "OTHER"] as const;
const text = (v: unknown, max: number) => { const s = typeof v === "string" ? v.trim().slice(0, max) : ""; return s || null; };
const posInt = (v: unknown, max: number) => { const n = typeof v === "number" ? v : NaN; return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n) : null; };
const posNum = (v: unknown, max: number) => { const n = typeof v === "number" ? v : NaN; return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null; };

function raceData(draft: RaceDraft) {
  const name = text(draft.name, 80), date = new Date(`${String(draft.date)}T12:00:00Z`), sport = String(draft.sport ?? "RUN");
  if (!name) return { ok: false as const, error: "Le nom de l’épreuve est obligatoire." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(draft.date)) || isNaN(+date)) return { ok: false as const, error: "La date est invalide." };
  if (!MY.includes(sport)) return { ok: false as const, error: "Sport non pris en charge." };
  const startTime = typeof draft.startTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(draft.startTime) ? draft.startTime : null;
  const url = text(draft.url, 500);
  if (url && !/^https?:\/\//i.test(url)) return { ok: false as const, error: "Le lien doit commencer par http(s)." };
  const data = {
    name, date, startTime, sport: sport as ActivityType,
    eventName: text(draft.eventName, 120), location: text(draft.location, 120),
    platform: (PLATFORMS as readonly string[]).includes(String(draft.platform)) ? draft.platform! : "OTHER" as const,
    targetDistance: posNum(draft.targetDistance, 1000), targetElevation: posNum(draft.targetElevation, 20000),
    priceCents: posInt(draft.priceCents, 100000), requiredDocument: text(draft.requiredDocument, 120),
    goalTimeS: posInt(draft.goalTimeS, 7 * 86400), bibNumber: text(draft.bibNumber, 20), notes: text(draft.notes, 1000),
  };
  return { ok: true as const, data, url };
}

/** Crée l'échéance, ou met à jour celle du même lien (un lien = une course par utilisateur). */
export async function saveImportedRace(draft: RaceDraft): Promise<{ ok: true; updated: boolean } | { ok: false; error: string }> {
  const userId = await uid(), r = raceData(draft);
  if (!r.ok) return r;
  const { data, url } = r;
  let updated = false;
  if (!url) await prisma.raceEvent.create({ data: { userId, ...data } });
  else {
    updated = !!(await prisma.raceEvent.findUnique({ where: { userId_url: { userId, url } }, select: { id: true } }));
    await prisma.raceEvent.upsert({ where: { userId_url: { userId, url } }, create: { userId, url, ...data }, update: data });
  }
  revalidatePath("/events"); revalidatePath("/");
  return { ok: true, updated };
}

/** Modifie une échéance existante (nom, date, heure, détails…). Le lien d'origine ne change pas. */
export async function updateEvent(id: string, draft: RaceDraft): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await uid(), r = raceData(draft);
  if (!r.ok) return r;
  const res = await prisma.raceEvent.updateMany({ where: { id, userId }, data: r.data });
  if (res.count === 0) return { ok: false, error: "Course introuvable." };
  revalidatePath("/events"); revalidatePath(`/events/${id}`); revalidatePath("/");
  return { ok: true };
}

const STATUSES = ["REGISTERED", "COMPLETED", "DNS", "DNF"] as const;
export type RaceStatusKey = (typeof STATUSES)[number];
const racePaths = (id: string) => { revalidatePath("/events"); revalidatePath(`/events/${id}`); revalidatePath("/"); };

/** Inscrit / Terminée / Non partant / Abandon. */
export async function setRaceStatus(id: string, status: RaceStatusKey): Promise<{ ok: boolean }> {
  const userId = await uid();
  if (!STATUSES.includes(status)) return { ok: false };
  const res = await prisma.raceEvent.updateMany({ where: { id, userId }, data: { status } });
  racePaths(id);
  return { ok: res.count > 0 };
}

/** Résultat : temps, classements, nombre de partants. Une course encore « Inscrit » passe en « Terminée » dès qu'un temps est saisi. */
export async function saveRaceResult(id: string, r: { resultTimeS?: number; rankOverall?: number; rankCategory?: number; participants?: number }): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await uid();
  const e = await prisma.raceEvent.findFirst({ where: { id, userId }, select: { status: true } });
  if (!e) return { ok: false, error: "Course introuvable." };
  const data = { resultTimeS: posInt(r.resultTimeS, 7 * 86400), rankOverall: posInt(r.rankOverall, 1e6), rankCategory: posInt(r.rankCategory, 1e6), participants: posInt(r.participants, 1e6) };
  if (data.rankOverall && data.participants && data.rankOverall > data.participants) return { ok: false, error: "Le classement dépasse le nombre de participants." };
  await prisma.raceEvent.update({ where: { id }, data: { ...data, ...(e.status === "REGISTERED" && data.resultTimeS ? { status: "COMPLETED" as const } : {}) } });
  racePaths(id);
  return { ok: true };
}

/** Lie à la main une activité à la course (une activité ne sert qu'à une course) ; une course « Inscrit » passe en « Terminée ». */
export async function linkRaceActivity(id: string, activityId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await uid();
  const [e, a] = await Promise.all([
    prisma.raceEvent.findFirst({ where: { id, userId }, select: { status: true } }),
    prisma.activity.findFirst({ where: { id: activityId, userId }, select: { raceEvent: { select: { id: true } } } }),
  ]);
  if (!e || !a) return { ok: false, error: "Introuvable." };
  if (a.raceEvent && a.raceEvent.id !== id) return { ok: false, error: "Cette sortie est déjà liée à une autre course." };
  await prisma.raceEvent.update({ where: { id }, data: { activityId, ...(e.status === "REGISTERED" ? { status: "COMPLETED" as const } : {}) } });
  racePaths(id); revalidatePath(`/activities/${activityId}`);
  return { ok: true };
}

/** Délie l'activité (mauvaise correspondance). Le statut est conservé : le rattachement auto ne ressaisit que les courses « Inscrit ». */
export async function unlinkRaceActivity(id: string): Promise<{ ok: boolean }> {
  const userId = await uid();
  const e = await prisma.raceEvent.findFirst({ where: { id, userId }, select: { activityId: true } });
  if (!e) return { ok: false };
  await prisma.raceEvent.update({ where: { id }, data: { activityId: null } });
  racePaths(id); if (e.activityId) revalidatePath(`/activities/${e.activityId}`);
  return { ok: true };
}

/** Recopie le temps de la montre (durée de l'activité liée) comme temps officiel, sans écraser un résultat déjà saisi. */
export async function adoptWatchTime(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await uid();
  const e = await prisma.raceEvent.findFirst({ where: { id, userId }, select: { resultTimeS: true, status: true, activity: { select: { movingTimeS: true } } } });
  if (!e?.activity?.movingTimeS) return { ok: false, error: "Aucun temps à recopier." };
  if (e.resultTimeS) return { ok: false, error: "Un temps officiel est déjà saisi." };
  await prisma.raceEvent.update({ where: { id }, data: { resultTimeS: e.activity.movingTimeS, ...(e.status === "REGISTERED" ? { status: "COMPLETED" as const } : {}) } });
  racePaths(id);
  return { ok: true };
}

/** Objectif de temps saisi depuis la section « Préparation ». */
export async function setRaceGoalTime(id: string, goalTimeS: number): Promise<{ ok: boolean }> {
  const userId = await uid();
  const v = posInt(goalTimeS, 7 * 86400);
  if (!v) return { ok: false };
  const res = await prisma.raceEvent.updateMany({ where: { id, userId }, data: { goalTimeS: v } });
  racePaths(id);
  return { ok: res.count > 0 };
}

/**
 * Objectif hebdo lié à la course : distance par semaine dans le sport de la course (cible de construction).
 * Réutilise le modèle Goal : met à jour l'objectif hebdo de distance existant pour ce sport plutôt que d'en créer un second.
 */
export async function createRaceGoal(id: string): Promise<{ ok: true; km: number; updated: boolean } | { ok: false; error: string }> {
  const userId = await uid();
  const e = await prisma.raceEvent.findFirst({ where: { id, userId }, select: { sport: true, targetDistance: true } });
  const km = weeklyGoalKm(e?.targetDistance ?? null);
  if (!e || !km) return { ok: false, error: "Renseigne d’abord la distance de la course." };
  const type = (e.sport === "WALK" ? "HIKE" : e.sport) as ActivityType;
  const prev = await prisma.goal.findFirst({ where: { userId, active: true, metric: "DISTANCE", period: "WEEK", type } });
  if (prev) await prisma.goal.update({ where: { id: prev.id }, data: { target: km * 1000 } });
  else await prisma.goal.create({ data: { userId, metric: "DISTANCE", period: "WEEK", type, target: km * 1000 } });
  revalidatePath("/goals"); racePaths(id);
  return { ok: true, km, updated: !!prev };
}

// ───────── Matériel ─────────
const gearPaths = () => { revalidatePath("/gear"); revalidatePath("/"); revalidatePath("/record"); };

/** Un seul matériel par défaut par sport (le home trainer a sa propre place : il sert aux sorties en intérieur). */
async function clearOtherDefaults(userId: string, g: { id: string; kind: GearKind; sports: ActivityType[] }) {
  if (!g.sports.length) return;
  await prisma.gear.updateMany({ where: { userId, id: { not: g.id }, isDefault: true, sports: { hasSome: g.sports }, kind: g.kind === "TRAINER" ? "TRAINER" : { not: "TRAINER" } }, data: { isDefault: false } });
}

export async function addGear(fd: FormData) {
  const userId = await uid(), kind = String(fd.get("kind")) as GearKindKey, name = String(fd.get("name") ?? "").trim().slice(0, 60);
  if (!name || !(kind in GEAR_KINDS)) return;
  const K = GEAR_KINDS[kind], parentId = String(fd.get("parentId") ?? "");
  const parent = parentId ? await prisma.gear.findFirst({ where: { id: parentId, userId, parentId: null } }) : null;
  const picked = fd.getAll("sports").map(String).filter((s) => (GEAR_SPORTS as readonly string[]).includes(s));
  const fallback: string[] = K.sports.length ? K.sports : K.part ? ["RIDE"] : [...GEAR_SPORTS];
  const sports = (parent ? [] : picked.length ? picked : fallback) as ActivityType[];
  const start = num(fd.get("startKm")), limit = num(fd.get("limitKm"));
  const g = await prisma.gear.create({ data: {
    userId, kind, name, sports, parentId: parent?.id ?? null, isDefault: !parent && fd.get("isDefault") === "on",
    startKm: start > 0 ? start : 0, limitKm: limit > 0 ? limit : fd.get("limitKm") === "" ? K.limitKm : null,
  } });
  if (g.isDefault) await clearOtherDefaults(userId, g);
  gearPaths();
}

export async function updateGear(id: string, fd: FormData) {
  const userId = await uid(), name = String(fd.get("name") ?? "").trim().slice(0, 60), start = num(fd.get("startKm")), limit = num(fd.get("limitKm"));
  await prisma.gear.updateMany({ where: { id, userId }, data: { ...(name && { name }), startKm: start > 0 ? start : 0, limitKm: limit > 0 ? limit : null } });
  gearPaths();
}

export async function setDefaultGear(id: string) {
  const userId = await uid(), g = await prisma.gear.findFirst({ where: { id, userId, parentId: null, retiredAt: null } });
  if (!g) return;
  await prisma.gear.update({ where: { id }, data: { isDefault: !g.isDefault } });
  if (!g.isDefault) await clearOtherDefaults(userId, g);
  gearPaths();
}

/** Remplacement (chaîne neuve, nouvelle paire…) : l'ancien est retiré avec son historique, le neuf repart de zéro avec le même rôle. */
export async function replaceGear(id: string) {
  const userId = await uid(), g = await prisma.gear.findFirst({ where: { id, userId, retiredAt: null } });
  if (!g) return;
  const now = new Date();
  await prisma.$transaction([
    prisma.gear.update({ where: { id }, data: { retiredAt: now, isDefault: false } }),
    prisma.gear.create({ data: { userId, kind: g.kind, name: g.name, sports: g.sports, parentId: g.parentId, isDefault: g.isDefault, limitKm: g.limitKm, installedAt: now } }),
    // Les composants d'un vélo remplacé restent sur l'ancien : ils sont retirés avec lui.
    prisma.gear.updateMany({ where: { userId, parentId: id, retiredAt: null }, data: { retiredAt: now } }),
  ]);
  gearPaths();
}

export async function retireGear(id: string) {
  const userId = await uid(), now = new Date();
  await prisma.gear.updateMany({ where: { userId, OR: [{ id }, { parentId: id }], retiredAt: null }, data: { retiredAt: now, isDefault: false } });
  gearPaths();
}

export async function deleteGear(id: string) { const userId = await uid(); await prisma.gear.deleteMany({ where: { id, userId } }); gearPaths(); }

/** Type de séance choisi à la main (null = retour à la détection). Seule écriture de Activity.sessionType. */
export async function setSessionType(id: string, value: string | null): Promise<Res> {
  const userId = await uid();
  if (value !== null && !isSessionType(value)) return { ok: false, error: "Type inconnu." };
  const r = await prisma.activity.updateMany({ where: { id, userId }, data: { sessionType: value } });
  if (r.count === 0) return { ok: false, error: "Activité introuvable." };
  revalidatePath("/activities"); revalidatePath(`/activities/${id}`); revalidatePath("/");
  return { ok: true };
}

/** Champ vide = retour à l'estimation automatique. Un seuil qui change de façon sensible fait recalculer les rubans de zones en arrière-plan. */
export async function saveZones(fd: FormData) {
  const userId = await uid(), ftp = num(fd.get("ftp")), hrMax = num(fd.get("hrMax"));
  const data = { ftp: ftp >= 50 && ftp <= 600 ? Math.round(ftp) : null, hrMax: hrMax >= 120 && hrMax <= 230 ? Math.round(hrMax) : null };
  const before = await getZones(userId);
  await prisma.userZones.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  // Saisie effacée : l'estimation reprend la main, autant qu'elle soit à jour tout de suite plutôt qu'à la prochaine nuit.
  if (data.hrMax == null && before.hrManual) await refreshEstimatedHrMax(userId).catch((e) => console.error("[seuils] FC max estimée", e));
  await onThresholdsChange(userId, before, await getZones(userId));
  revalidatePath("/vous/seuils"); revalidatePath("/vous"); revalidatePath("/analysis");
}

// ───────── Muscu : catalogue d'exercices et rapprochement de l'historique ─────────
const exercisePaths = () => { revalidatePath("/plan"); revalidatePath("/plan/exercices", "layout"); };

/** Bouton « Mettre à jour le catalogue » : synchro complète, puis rattachement des noms dont la correspondance est exacte. */
export async function updateExerciseCatalog(): Promise<{ ok: true; result: CatalogSyncResult } | { ok: false; error: string }> {
  const userId = await uid();
  try { const result = await syncCatalogAndHistory(userId); exercisePaths(); return { ok: true, result }; }
  catch (e) { console.error("[exercises] mise à jour du catalogue", e); return { ok: false, error: "Mise à jour impossible, réessaie dans un instant." }; }
}

export async function linkExerciseNameAction(key: string, exerciseId: string): Promise<Res> {
  const userId = await uid();
  if (!key || !(await canUseExercise(userId, exerciseId))) return { ok: false, error: "Exercice introuvable." };
  if (!(await linkExerciseName(userId, key, exerciseId))) return { ok: false, error: "Aucune séance ne porte ce nom." };
  exercisePaths();
  return { ok: true };
}

export async function createCustomExerciseAction(key: string, o: { name: string; equipment: string; loadType: string }): Promise<Res> {
  const userId = await uid(), name = String(o.name ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "Donne un nom à l'exercice." };
  if (!(o.equipment in EQUIPMENT_LABELS) || !(o.loadType in LOAD_TYPE_LABELS)) return { ok: false, error: "Choisis le matériel et le type de charge." };
  const ex = await createCustomExercise(userId, key, { name, equipment: o.equipment as Equipment, loadType: o.loadType as LoadType });
  if (!ex) return { ok: false, error: "Aucune séance ne porte ce nom." };
  exercisePaths();
  return { ok: true };
}

// ───────── Suppression d'une activité ─────────
/** Supprime une de mes activités (séries, trace, photos suivent) : la séance qu'elle validait redevient à faire (et son programme reprend s'il était terminé), records recalculés, paliers de badges perdus retirés. */
export async function deleteActivity(id: string): Promise<Res> {
  const userId = await uid();
  if (!(await prisma.activity.findFirst({ where: { id, userId }, select: { id: true } }))) return { ok: false, error: "Activité introuvable." };
  const [held, session, user] = await Promise.all([
    prisma.personalRecord.findMany({ where: { userId, activityId: id }, select: { kind: true, type: true } }),
    prisma.plannedSession.findFirst({ where: { userId, completedActivityId: id, status: "COMPLETED" }, select: { programId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ]);
  await prisma.$transaction([
    prisma.plannedSession.updateMany({ where: { userId, completedActivityId: id, status: "COMPLETED" }, data: { status: "PLANNED", completedAt: null, complianceScore: null } }),
    prisma.activity.delete({ where: { id } }),
  ]);
  // Records d'abord : le badge « 5 km » s'appuie sur le record recalculé.
  await recomputeRecords(userId, held).catch((e) => console.error("[activities] recalcul des records", e));
  await revokeLostBadges(userId, user?.timezone ?? "Europe/Paris").catch((e) => console.error("[activities] badges", e));
  if (session) await reopenIfNeeded(session.programId).catch((e) => console.error("[activities] programme", e));
  for (const p of ["/", "/activities", "/plan", "/analysis", "/fitness", "/goals", "/events", "/gear", "/plan/exercices"]) revalidatePath(p, p === "/plan/exercices" ? "layout" : "page");
  return { ok: true };
}

// ───────── Itinéraires ─────────
/** Domicile = départ par défaut des boucles. */
export async function setHome(lat: number, lng: number) {
  const userId = await uid();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false };
  await prisma.user.update({ where: { id: userId }, data: { homeLat: Math.round(lat * 1e5) / 1e5, homeLng: Math.round(lng * 1e5) / 1e5 } });
  revalidatePath("/itineraires");
  return { ok: true };
}

export async function setRouteSaved(id: string, saved: boolean) {
  const userId = await uid();
  await prisma.suggestedRoute.updateMany({ where: { id, userId }, data: { saved } });
  revalidatePath("/itineraires");
  revalidatePath(`/itineraires/${id}`);
  return { ok: true };
}

/**
 * Prépare un de tes classiques tel quel (vraie trace de la sortie la plus représentative) comme boucle à exporter en GPX.
 * Renvoie l'id de la boucle créée, ouverte ensuite sur /itineraires/[id].
 */
export async function prepareClassic(sport: "RUN" | "RIDE", classicId: string) {
  const userId = await uid();
  if (sport !== "RUN" && sport !== "RIDE") return { ok: false as const };
  const { getHabits } = await import("@/lib/habits/build");
  const { classicTitle } = await import("@/lib/habits/grid");
  const { buildProfile, estimateMinutes, HISTORY_DAYS } = await import("@/lib/routes/estimate");
  const { decodePolyline, encodePolyline } = await import("@/lib/polyline");
  const h = await getHabits(userId, sport);
  const c = h?.classics.find((x) => x.id === classicId);
  if (!c) return { ok: false as const };

  const [rep, acts] = await Promise.all([
    prisma.activity.findFirst({ where: { id: c.repId, userId }, select: { trackPoints: true } }),
    prisma.activity.findMany({
      where: { userId, type: { in: ["RUN", "RIDE"] }, startedAt: { gte: new Date(Date.now() - HISTORY_DAYS * 864e5) } },
      select: { type: true, startedAt: true, distanceM: true, movingTimeS: true, source: true, dedupeKey: true, startLat: true, title: true },
    }),
  ]);
  const tp = ((rep?.trackPoints as { lat?: number; lng?: number; ele?: number }[] | null) ?? []).filter((x) => x.lat != null && x.lng != null);
  const coords = tp.length > 1 ? tp.map((x) => [x.lat!, x.lng!, x.ele ?? 0] as const) : decodePolyline(c.polyline).map(([lat, lng]) => [lat, lng, 0] as const);
  // Trace allégée (≤ 600 points) : la fiche et le GPX restent légers.
  const stride = Math.max(1, Math.ceil(coords.length / 600)), slim = coords.filter((_, i) => i % stride === 0 || i === coords.length - 1);
  const est = Math.round(estimateMinutes(buildProfile(sport, sport === "RIDE" ? "road" : undefined, acts), c.distanceM / 1000, c.ascentM));
  const r = await prisma.suggestedRoute.create({
    data: {
      userId, sport, variant: sport === "RIDE" ? "road" : null, minutes: est, startLat: c.start.lat, startLng: c.start.lng,
      polyline: encodePolyline(slim.map(([lat, lng]) => [lat, lng])), elevation: slim.map((x) => Math.round(x[2])),
      distanceM: c.distanceM, ascentM: c.ascentM, estMinutes: est,
      label: "Ton classique", why: `${classicTitle(c)} · faite ${c.count} fois`,
      scores: { familiar: 1, global: 0, osm: false }, pois: [],
    },
    select: { id: true },
  });
  revalidatePath("/itineraires");
  return { ok: true as const, id: r.id };
}
