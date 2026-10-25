/** Données du coach du jour (côté serveur) : une requête par source, puis lib/coach/today.ts décide. */
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/dates";
import { FITNESS_HISTORY_DAYS, formSeries, zone } from "@/lib/fitness";
import { isSoftActivity } from "@/lib/sports";
import { buildProfile, estimateMinutes, HISTORY_DAYS, isCommute } from "@/lib/routes/estimate";
import { loadHabitIndex } from "@/lib/habits/build";
import { classicTitle, dist, proj } from "@/lib/habits/grid";
import { aggregate, getForecast } from "@/lib/weather/open-meteo";
import type { RunProgramView } from "@/lib/data/training";
import { bestSlot, coachToday, EASY_RUN_MIN, liftHalf, type CoachInput, type CoachPlan } from "./today";

/** Un classique « tient » dans la séance à ±12 % et part à moins de 600 m de chez toi. */
const CLASSIC_FIT = 0.12;
const CLASSIC_NEAR_M = 600;

export async function getCoach(userId: string, run: RunProgramView | null, now = new Date()): Promise<CoachPlan> {
  return coachToday(await loadCoachInput(userId, run, now));
}

/** Entrées du coach (aussi utilisées par les notifications : créneau, séance du programme). */
export async function loadCoachInput(userId: string, run: RunProgramView | null, now = new Date()): Promise<CoachInput> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, homeLat: true, homeLng: true } });
  const tz = user?.timezone ?? "Europe/Paris";
  const [fitActs, recent, lastRun, lastLift] = await Promise.all([
    prisma.activity.findMany({ where: { userId, startedAt: { gte: new Date(+now - FITNESS_HISTORY_DAYS * 864e5) } }, select: { startedAt: true, movingTimeS: true, type: true, load: true, source: true, dedupeKey: true, title: true } }),
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: new Date(+now - HISTORY_DAYS * 864e5) } },
      select: { type: true, title: true, startedAt: true, distanceM: true, movingTimeS: true, source: true, dedupeKey: true, startLat: true },
    }),
    prisma.activity.findFirst({ where: { userId, type: "RUN" }, orderBy: { startedAt: "desc" }, select: { startedAt: true } }),
    prisma.activity.findFirst({
      where: { userId, type: "WORKOUT" }, orderBy: { startedAt: "desc" },
      select: { startedAt: true, exercises: { select: { exercise: { select: { primaryMuscles: true } } } } },
    }),
  ]);

  const fit = formSeries(fitActs, now, tz).at(-1);
  const today = dayKey(now, tz);
  const todayDone = recent.filter((a) => dayKey(a.startedAt, tz) === today && !isCommute(a)).map((a) => ({ type: a.type, title: a.title }));

  const next = run?.status === "ACTIVE" ? run.next : null;
  const runNext = next ? { title: next.title, summary: next.summary, minutes: Math.max(15, Math.round(next.durationS / 60)), date: next.date, isKey: next.isKeySession, kind: next.kind } : null;
  const minutes = runNext?.minutes ?? EASY_RUN_MIN;

  // Météo et classiques : seulement si le domicile est connu (départ des boucles).
  let slot: CoachInput["slot"] = null, classic: CoachInput["classic"] = null;
  if (user?.homeLat != null && user.homeLng != null) {
    const home = { lat: user.homeLat, lng: user.homeLng };
    const [raw, habits] = await Promise.all([getForecast(home.lat, home.lng), loadHabitIndex(userId, "RUN").catch(() => null)]);
    if (raw) slot = bestSlot((t) => aggregate(raw, t, minutes, +now), +now, minutes, tz);
    if (habits) {
      const profile = buildProfile("RUN", undefined, recent, now), p = proj(home.lat);
      const fits = habits.classics
        .filter((c) => dist(p, [c.start.lat, c.start.lng], [home.lat, home.lng]) <= CLASSIC_NEAR_M)
        .map((c) => ({ c, est: estimateMinutes(profile, c.distanceM / 1000, c.ascentM) }))
        .filter(({ est }) => Math.abs(est - minutes) / minutes <= CLASSIC_FIT)
        .sort((a, b) => b.c.count - a.c.count)[0];
      if (fits) classic = { title: classicTitle(fits.c), minutes: Math.round(fits.est) };
    }
  }

  const muscles = (lastLift?.exercises ?? []).flatMap((e) => (e.exercise?.primaryMuscles as string[] | undefined) ?? []);
  return {
    now: +now, tz,
    form: { value: fit?.form ?? 0, label: zone(fit?.form ?? 0).label },
    todayDone,
    lastRunAt: lastRun ? +lastRun.startedAt : null,
    lastLiftAt: lastLift ? +lastLift.startedAt : null,
    lastLiftHalf: liftHalf(muscles),
    runNext, slot, classic,
  };
}
