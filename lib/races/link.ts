import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { dayKey, shiftDay } from "@/lib/dates";
import { findRaceActivity } from "./match";
import { getRaceStartDate, raceDayKey, RACE_TZ } from "./time";

/**
 * Rattache aux courses « Inscrit » des 7 derniers jours (aujourd'hui inclus) l'activité du jour J, puis les passe en « Terminée ».
 * N'écrase jamais un activityId déjà défini (même à la main). Renvoie le nombre de courses rattachées.
 */
export async function matchRaceActivities(userId: string, now: Date = new Date()): Promise<number> {
  const today = dayKey(now, RACE_TZ);
  const races = await prisma.raceEvent.findMany({
    where: { userId, activityId: null, status: "REGISTERED", date: { gte: new Date(`${shiftDay(today, -6)}T00:00:00Z`), lte: new Date(`${today}T23:59:59Z`) } },
    orderBy: { date: "asc" },
  });
  if (!races.length) return 0;

  // Activités depuis la veille du plus ancien jour J ; celles déjà liées à une autre course sont exclues.
  const since = getRaceStartDate({ date: shiftDay(raceDayKey(races[0].date), -1) });
  const acts = await prisma.activity.findMany({
    where: { userId, startedAt: { gte: since }, raceEvent: null },
    select: { id: true, type: true, startedAt: true, distanceM: true },
  });

  let linked = 0;
  const used = new Set<string>();
  for (const race of races) {
    const best = findRaceActivity(race, acts.filter((a) => !used.has(a.id)));
    if (!best) continue;
    try {
      const res = await prisma.raceEvent.updateMany({ where: { id: race.id, userId, activityId: null }, data: { activityId: best.id, status: "COMPLETED" } });
      if (res.count) { used.add(best.id); linked++; }
    } catch (e) { console.error("[races] rattachement impossible", race.id, e); }
  }
  if (linked) { try { revalidatePath("/events"); revalidatePath("/"); } catch { /* hors contexte Next : sans effet */ } }
  return linked;
}
