import { prisma } from "@/lib/prisma";
import { dayKey, weekKeys } from "@/lib/dates";
import { weeklyInsights } from "@/lib/insights/engine";
import { fitnessSeries } from "@/lib/fitness";
import { level, xpOf } from "@/lib/xp";
import { daysUntil, readiness } from "@/lib/events";
import type { Act } from "@/lib/insights/types";

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

export async function getDashboard(userId: string) {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone ?? "Europe/Paris";
  const [rows, goal, goalCount, allXp, fitActs, eventsRaw] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: new Date(+now - 100 * 864e5) } }, orderBy: { startedAt: "desc" },
      select: { id: true, type: true, title: true, story: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, calories: true, avgHr: true, avgPower: true, polyline: true, startLat: true, startLng: true, weather: true, exercises: { select: { sets: true, reps: true, loadKg: true } } },
    }),
    prisma.goal.findFirst({ where: { userId, active: true, metric: "DISTANCE", period: "WEEK", type: null } }),
    prisma.goal.count({ where: { userId, active: true } }),
    prisma.activity.findMany({ where: { userId }, select: { distanceM: true, elevationGainM: true, movingTimeS: true, type: true } }),
    prisma.activity.findMany({ where: { userId, startedAt: { gte: new Date(+now - 330 * 864e5) } }, select: { startedAt: true, movingTimeS: true, type: true } }),
    prisma.raceEvent.findMany({ where: { userId, date: { gte: new Date(+now - 864e5) } }, orderBy: { date: "asc" }, take: 5 }),
  ]);

  const todayKey = dayKey(now, tz), keys = weekKeys(now, tz), keySet = new Set(keys);
  const week = rows.filter((a) => keySet.has(dayKey(a.startedAt, tz)));
  const days = keys.map((key, i) => {
    const d = week.filter((a) => dayKey(a.startedAt, tz) === key);
    const top = [...d].sort((a, b) => b.distanceM - a.distanceM)[0];
    return { key, label: "LMMJVSD"[i], km: sum(d, (a) => a.distanceM) / 1000, type: top?.type ?? null, today: key === todayKey };
  });

  // Série : semaines d'affilée avec au moins 2 jours actifs. La semaine en cours ne casse jamais la série.
  const active = new Set(rows.map((a) => dayKey(a.startedAt, tz)));
  let streak = 0;
  for (let k = 0; k < 14; k++) {
    const ok = weekKeys(now, tz, -k).filter((d) => active.has(d)).length >= 2;
    if (k === 0 && !ok) continue;
    if (!ok) break;
    streak++;
  }

  const insights = weeklyInsights(rows.map((r) => ({ ...r, weather: r.weather as Act["weather"] })), { now, tz });
  const fit = fitnessSeries(fitActs, now, tz).at(-1)!, xp = level(allXp.reduce((t, a) => t + xpOf(a), 0));
  const weekXp = week.reduce((t, a) => t + xpOf(a), 0);
  const events = eventsRaw.map((e) => ({ id: e.id, name: e.name, date: e.date, sport: e.sport as string, targetDistance: e.targetDistance, targetElevation: e.targetElevation, days: daysUntil(e.date, now, tz), ...readiness(e, rows, now) })).filter((e) => e.days >= 0);
  return {
    fit, xp, weekXp, goalCount, events,
    km: sum(week, (a) => a.distanceM) / 1000, days, streak, insights,
    timeS: sum(week, (a) => a.movingTimeS), elevation: sum(week, (a) => a.elevationGainM), kcal: week.some((a) => a.calories != null) ? sum(week, (a) => a.calories ?? 0) : null,
    goalKm: goal ? goal.target / 1000 : 30, recent: rows.slice(0, 5), empty: rows.length === 0,
    range: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).formatRange(new Date(keys[0]), new Date(keys[6])),
  };
}
