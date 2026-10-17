"use server";
import { revalidatePath } from "next/cache";
import type { ActivityType, GearKind, GoalMetric, GoalPeriod } from "@prisma/client";
import { GEAR_KINDS, GEAR_SPORTS, type GearKindKey } from "@/lib/gear";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AGE_BANDS } from "@/lib/bench";
import { METRICS, PERIODS } from "@/lib/goals";
import { buildPlan, PLAN_GOALS, type PlanSport } from "@/lib/plan";
import { importRaceFromUrl } from "@/lib/races/import";
import { weeklyGoalKm } from "@/lib/races/prep";
import type { RaceDraft } from "@/types/race";

const MY = ["RUN", "RIDE", "HIKE", "WORKOUT"];
async function uid() { const id = (await auth())?.user?.id; if (!id) throw new Error("unauthorized"); return id; }

export async function addGoal(fd: FormData) {
  const userId = await uid();
  const metric = String(fd.get("metric")), period = String(fd.get("period")), type = String(fd.get("type")), t = parseFloat(String(fd.get("target")).replace(",", "."));
  if (!(metric in METRICS) || !(period in PERIODS) || !(t > 0)) return;
  await prisma.goal.create({ data: { userId, metric: metric as GoalMetric, period: period as GoalPeriod, type: MY.includes(type) ? (type as ActivityType) : null, target: t * METRICS[metric as keyof typeof METRICS].base } });
  revalidatePath("/goals");
}
export async function deleteGoal(id: string) { const userId = await uid(); await prisma.goal.deleteMany({ where: { id, userId } }); revalidatePath("/goals"); }

export async function saveProfile(fd: FormData) {
  const userId = await uid(), age = String(fd.get("age")), sex = String(fd.get("sex"));
  await prisma.user.update({ where: { id: userId }, data: { ageBand: AGE_BANDS.includes(age) ? age : null, sex: sex === "H" || sex === "F" ? sex : null } });
  revalidatePath("/bench");
}

export async function generatePlan(fd: FormData) {
  const userId = await uid(), sport = String(fd.get("sport")) as PlanSport;
  const goalIdx = Number(fd.get("goalIdx")), weeks = Number(fd.get("weeks")), days = Number(fd.get("days"));
  if (!MY.includes(sport) || ![4, 8, 12].includes(weeks) || !(days >= 2 && days <= 5) || !(goalIdx >= 0 && goalIdx < PLAN_GOALS[sport].length)) return;
  const agg = await prisma.activity.aggregate({ where: { userId, type: sport as ActivityType, startedAt: { gte: new Date(Date.now() - 28 * 864e5) } }, _sum: { distanceM: true } });
  const plan = buildPlan({ sport, goalIdx, weeks, days, baseWeeklyKm: (agg._sum.distanceM ?? 0) / 4000 });
  await prisma.$transaction([prisma.trainingPlan.deleteMany({ where: { userId } }), prisma.trainingPlan.create({ data: { userId, sport: sport as ActivityType, goalLabel: plan.goalLabel, weeks, days: plan.days, data: plan as object, done: [] } })]);
  revalidatePath("/plan");
}
export async function toggleSession(planId: string, key: string) {
  const userId = await uid(), p = await prisma.trainingPlan.findFirst({ where: { id: planId, userId } });
  if (!p) return;
  await prisma.trainingPlan.update({ where: { id: p.id }, data: { done: p.done.includes(key) ? p.done.filter((k) => k !== key) : [...p.done, key] } });
  revalidatePath("/plan");
}
export async function deletePlan() { const userId = await uid(); await prisma.trainingPlan.deleteMany({ where: { userId } }); revalidatePath("/plan"); }

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

/** Champ vide = retour à l'estimation automatique. */
export async function saveZones(fd: FormData) {
  const userId = await uid(), ftp = num(fd.get("ftp")), hrMax = num(fd.get("hrMax"));
  const data = { ftp: ftp >= 50 && ftp <= 600 ? Math.round(ftp) : null, hrMax: hrMax >= 120 && hrMax <= 230 ? Math.round(hrMax) : null };
  await prisma.userZones.upsert({ where: { userId }, update: data, create: { userId, ...data } });
  revalidatePath("/profile"); revalidatePath("/analysis");
}
