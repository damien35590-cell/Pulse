"use server";
import { revalidatePath } from "next/cache";
import type { ActivityType, GearKind, GoalMetric, GoalPeriod } from "@prisma/client";
import { GEAR_KINDS, GEAR_SPORTS, type GearKindKey } from "@/lib/gear";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AGE_BANDS } from "@/lib/bench";
import { METRICS, PERIODS } from "@/lib/goals";
import { buildPlan, PLAN_GOALS, type PlanSport } from "@/lib/plan";

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

// ───────── Échéances et seuils ─────────
const num = (v: FormDataEntryValue | null) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : NaN; };

export async function addEvent(fd: FormData) {
  const userId = await uid(), name = String(fd.get("name") ?? "").trim().slice(0, 80), date = new Date(`${String(fd.get("date"))}T12:00:00Z`), sport = String(fd.get("sport")), dist = num(fd.get("distance")), elev = num(fd.get("elevation"));
  if (!name || isNaN(+date) || !MY.includes(sport)) return;
  await prisma.raceEvent.create({ data: { userId, name, date, sport: sport as ActivityType, targetDistance: dist > 0 ? dist : null, targetElevation: elev > 0 ? elev : null } });
  revalidatePath("/events"); revalidatePath("/");
}
export async function deleteEvent(id: string) { const userId = await uid(); await prisma.raceEvent.deleteMany({ where: { id, userId } }); revalidatePath("/events"); revalidatePath("/"); }

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
