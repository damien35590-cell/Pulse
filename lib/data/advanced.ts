import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/dates";
import { bestCurve } from "@/lib/power";
import { bounds, HR_PCT, POWER_PCT, timeInZones } from "@/lib/zones";
import { cyclingRadar, runningRadar, type Axis } from "@/lib/radar";
import { volumeByMuscle } from "@/lib/muscles";
import { mean, type StreamData } from "@/lib/stream";
import { getZones } from "./zones";

type Curve = (number | null)[] | null;

/** Données des blocs avancés de la page Analyse : radar par discipline, courbe de puissance, muscles sur 7 jours. */
export async function getAdvanced(userId: string, tz: string) {
  const now = new Date(), ago = (d: number) => new Date(+now - d * 864e5), weeks = 90 / 7;
  const zones = await getZones(userId);
  const [recent, curves, ex, user, runs] = await Promise.all([
    prisma.activityStream.findMany({ where: { activity: { userId, startedAt: { gte: ago(90) } } }, take: 80, select: { data: true, curve: true, avgCad: true, activity: { select: { type: true, avgPower: true } } } }),
    prisma.activityStream.findMany({ where: { activity: { userId } }, select: { curve: true, activity: { select: { startedAt: true } } } }),
    prisma.workoutExercise.findMany({ where: { activity: { userId, type: "WORKOUT", startedAt: { gte: ago(7) } } }, select: { name: true, sets: true, reps: true, loadKg: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { weightKg: true } }),
    prisma.activity.findMany({ where: { userId, type: "RUN", startedAt: { gte: ago(90) } }, select: { startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true } }),
  ]);

  let cycling: Axis[] | null = null;
  const rides = recent.filter((r) => r.activity.type === "RIDE");
  if (rides.length) {
    const cv = bestCurve(rides.map((r) => r.curve as Curve)), ub = zones.ftp ? bounds(zones.ftp, POWER_PCT) : null;
    const z2 = ub ? rides.reduce((s, r) => s + timeInZones((r.data as unknown as StreamData).power ?? [], ub)[1], 0) : 0;
    const pw = rides.map((r) => r.activity.avgPower).filter((v): v is number => !!v), cad = rides.map((r) => r.avgCad).filter((v): v is number => !!v);
    cycling = cyclingRadar({ z2HoursPerWeek: z2 / 3600 / weeks, best5s: cv[0], best5m: cv[3], best20m: cv[4], avgPower: pw.length ? mean(pw) : null, avgCad: cad.length ? mean(cad) : null, ftp: zones.ftp });
  }

  let running: Axis[] | null = null;
  if (runs.length) {
    const km = runs.reduce((s, r) => s + r.distanceM, 0) / 1000, sec = runs.reduce((s, r) => s + r.movingTimeS, 0);
    let share: number | null = null;
    if (zones.hrMax) {
      const ub = bounds(zones.hrMax, HR_PCT); let tot = 0, tgt = 0;
      for (const r of recent.filter((x) => x.activity.type === "RUN")) { const t = timeInZones((r.data as unknown as StreamData).hr ?? [], ub, true); tot += t.reduce((a, b) => a + b, 0); tgt += t[1] + t[2]; }
      share = tot ? tgt / tot : null;
    }
    running = runningRadar({ longestKm: Math.max(...runs.map((r) => r.distanceM)) / 1000, avgPace: km > 0 ? sec / 60 / km : null, dPlusPerWeek: runs.reduce((s, r) => s + r.elevationGainM, 0) / weeks, activeDaysPerWeek: new Set(runs.map((r) => dayKey(r.startedAt, tz))).size / weeks, hrTargetShare: share });
  }

  const d30 = +ago(30);
  return {
    cycling, running, zones,
    record: bestCurve(curves.map((c) => c.curve as Curve)),
    last30: bestCurve(curves.filter((c) => +c.activity.startedAt >= d30).map((c) => c.curve as Curve)),
    muscles: volumeByMuscle(ex, user?.weightKg ?? 70), hasMuscle: ex.length > 0,
  };
}
