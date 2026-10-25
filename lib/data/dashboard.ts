import { prisma } from "@/lib/prisma";
import { dayKey, weekKeys } from "@/lib/dates";
import { weeklyInsights } from "@/lib/insights/engine";
import { fitnessSeries, zone } from "@/lib/fitness";
import { MUSCLE_LABELS } from "@/lib/training/catalog/exercises";
import { level, xpOf } from "@/lib/xp";
import { prepLine, racePrep } from "@/lib/races/prep";
import { getCountdown, needsResult } from "@/lib/races/time";
import { uniqueById } from "@/lib/utils";
import { isSoftActivity } from "@/lib/sports";
import { TARGET_LIFTS, TARGET_RUNS } from "@/lib/analytics/coach-notes";
import type { Act } from "@/lib/insights/types";

const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + f(x), 0);

export async function getDashboard(userId: string) {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone ?? "Europe/Paris";
  const [rows, goalRows, goalCount, allXp, fitActs, eventsRaw, pendingRaw, plannedRaw, countGoals, programs] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: new Date(+now - 100 * 864e5) } }, orderBy: { startedAt: "desc" },
      select: { id: true, type: true, title: true, story: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, calories: true, avgHr: true, avgPower: true, polyline: true, startLat: true, startLng: true, weather: true, sessionType: true, exercises: { select: { sets: true, reps: true, loadKg: true, exercise: { select: { primaryMuscles: true } } } } },
    }),
    prisma.goal.findMany({ where: { userId, active: true, metric: "DISTANCE", period: "WEEK" }, orderBy: { createdAt: "asc" } }),
    prisma.goal.count({ where: { userId, active: true } }),
    prisma.activity.findMany({ where: { userId }, select: { distanceM: true, elevationGainM: true, movingTimeS: true, type: true } }),
    prisma.activity.findMany({ where: { userId, startedAt: { gte: new Date(+now - 330 * 864e5) } }, select: { startedAt: true, movingTimeS: true, type: true, load: true } }),
    prisma.raceEvent.findMany({ where: { userId, status: { not: "DNS" }, date: { gte: new Date(+now - 864e5) } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 6 }),
    prisma.raceEvent.findMany({ where: { userId, status: "REGISTERED", date: { lt: new Date(+now + 864e5) } }, orderBy: { date: "desc" }, take: 3, select: { id: true, name: true, date: true, startTime: true, status: true } }),
    // Séances prévues au programme cette semaine (hors passées / déplacées) : pastilles en pointillé dans la semaine.
    prisma.plannedSession.findMany({ where: { userId, date: { gte: new Date(weekKeys(now, tz)[0]), lte: new Date(weekKeys(now, tz)[6]) }, status: { in: ["PLANNED", "COMPLETED", "PARTIAL"] } }, select: { date: true } }),
    // Cibles hebdo : objectifs « nombre de séances » et programmes en cours (course, muscu).
    prisma.goal.findMany({ where: { userId, active: true, metric: "ACTIVITIES", period: "WEEK", type: { in: ["RUN", "WORKOUT"] } }, orderBy: { createdAt: "asc" }, select: { type: true, target: true } }),
    prisma.program.findMany({ where: { userId, sport: { in: ["RUN", "WORKOUT"] }, status: { in: ["ACTIVE", "PAUSED"] } }, orderBy: { createdAt: "desc" }, select: { sport: true, sessionsPerWeek: true } }),
  ]);

  const todayKey = dayKey(now, tz), keys = weekKeys(now, tz), keySet = new Set(keys);
  const week = rows.filter((a) => keySet.has(dayKey(a.startedAt, tz)));
  const plannedKeys = plannedRaw.map((p) => p.date.toISOString().slice(0, 10));
  const days = keys.map((key, i) => {
    const d = week.filter((a) => dayKey(a.startedAt, tz) === key);
    const top = [...d].sort((a, b) => b.distanceM - a.distanceM)[0];
    const min = (list: typeof d) => Math.round(sum(list, (a) => a.movingTimeS) / 60);
    return {
      key, label: "LMMJVSD"[i], km: sum(d, (a) => a.distanceM) / 1000, type: top?.type ?? null, today: key === todayKey,
      run: min(d.filter((a) => a.type !== "WORKOUT" && !isSoftActivity(a))), lift: min(d.filter((a) => a.type === "WORKOUT")), planned: plannedKeys.includes(key),
    };
  });
  const runKm = sum(week.filter((a) => a.type === "RUN"), (a) => a.distanceM) / 1000;
  // Séances par discipline face à leur propre cible (objectif fixé, sinon programme, sinon cible par défaut) :
  // ne jamais comparer toutes les séances aux seules séances course prévues (« 2 / 1 »).
  const target = (sport: "RUN" | "WORKOUT", fallback: number) =>
    countGoals.find((g) => g.type === sport)?.target ?? programs.find((p) => p.sport === sport)?.sessionsPerWeek ?? fallback;
  const targets = { run: target("RUN", TARGET_RUNS[1]), lift: target("WORKOUT", TARGET_LIFTS[1]) };

  // Série : semaines d'affilée avec au moins 2 jours actifs. La semaine en cours ne casse jamais la série.
  const active = new Set(rows.filter((a) => !isSoftActivity(a)).map((a) => dayKey(a.startedAt, tz)));
  let streak = 0;
  for (let k = 0; k < 14; k++) {
    const ok = weekKeys(now, tz, -k).filter((d) => active.has(d)).length >= 2;
    if (k === 0 && !ok) continue;
    if (!ok) break;
    streak++;
  }

  const insights = weeklyInsights(rows.map((r) => ({ ...r, weather: r.weather as Act["weather"] })), { now, tz });
  const series = fitnessSeries(fitActs, now, tz), fit = series.at(-1)!, xp = level(allXp.reduce((t, a) => t + xpOf(a), 0));
  const weekXp = week.reduce((t, a) => t + xpOf(a), 0);
  // Un objectif par sport (ou « tous sports ») : la distance de la semaine ne compte que le sport concerné. Sans objectif : 30 km, tous sports.
  const goals = (goalRows.length ? goalRows.map((g) => ({ id: g.id, sport: g.type as string | null, goalKm: g.target / 1000 })) : [{ id: "default", sport: null as string | null, goalKm: 30 }])
    .map((g) => ({ ...g, km: sum(week.filter((a) => !g.sport || a.type === g.sport), (a) => a.distanceM) / 1000 }));
  // Courses : compte à rebours à l'heure de Paris (heure de départ comprise), une course reste « à venir » tout le jour J.
  const events = eventsRaw.map((e) => ({ e, c: getCountdown(e, now) })).filter(({ c }) => !c.isPast)
    .map(({ e, c }) => {
      const p = racePrep(e, rows, now, tz); // phase + état de préparation (lib/races/prep.ts)
      return { id: e.id, name: e.name, date: e.date, startTime: e.startTime, sport: e.sport as string, targetDistance: e.targetDistance, targetElevation: e.targetElevation, days: c.days, label: c.label, short: c.short, prep: prepLine(p), state: p.state };
    });
  const pendingResult = pendingRaw.find((e) => needsResult(e, now)) ?? null;
  const ctl = Math.round(fit.ctl);
  const form = { ctl, delta: ctl - Math.round(series.at(-8)?.ctl ?? fit.ctl), spark: series.slice(-14).map((f) => f.ctl), label: zone(fit.form).label };
  const muscles = (a: (typeof rows)[number]) => [...new Set(a.exercises.flatMap((e) => e.exercise?.primaryMuscles ?? []))].map((m) => MUSCLE_LABELS[m]);
  return {
    form, runKm, runCount: week.filter((a) => a.type === "RUN").length, liftCount: week.filter((a) => a.type === "WORKOUT").length, targets, fit, xp, weekXp, goalCount, events, pendingResult: pendingResult && { id: pendingResult.id, name: pendingResult.name },
    km: sum(week, (a) => a.distanceM) / 1000, days, streak, insights,
    timeS: sum(week, (a) => a.movingTimeS), elevation: sum(week, (a) => a.elevationGainM), kcal: week.some((a) => a.calories != null) ? sum(week, (a) => a.calories ?? 0) : null,
    goals, recent: uniqueById(rows.filter((a) => !isSoftActivity(a))).slice(0, 3).map((a) => ({ ...a, muscles: muscles(a) })), empty: rows.length === 0,
    range: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" }).formatRange(new Date(keys[0]), new Date(keys[6])),
  };
}
