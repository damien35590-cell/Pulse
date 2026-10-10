"use server";
import { revalidatePath } from "next/cache";
import type { ActivityType, GoalMetric, GoalPeriod } from "@prisma/client";
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
