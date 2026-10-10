import { dayKey } from "./dates";

/** Repères INDICATIFS par âge et sexe : ordres de grandeur courants, pas une étude. À ajuster. */
const VOL: Record<string, number> = { "18-29": 1, "30-39": 1, "40-49": 0.95, "50-59": 0.85, "60+": 0.7 };
const PACE: Record<string, number> = { "18-29": 1, "30-39": 1.03, "40-49": 1.08, "50-59": 1.16, "60+": 1.28 };
export const AGE_BANDS = Object.keys(VOL);

type A = { startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; type: string };
export function recentStats(acts: A[], now: Date, tz: string) {
  const t = +now, within = (a: A, d: number) => t - +a.startedAt <= d * 864e5 && a.startedAt <= now;
  const runs = acts.filter((a) => a.type === "RUN" && within(a, 28)), runKm = runs.reduce((s, a) => s + a.distanceM, 0) / 1000;
  return {
    runKmWeek: runKm / 4, runPace: runKm > 0 ? runs.reduce((s, a) => s + a.movingTimeS, 0) / 60 / runKm : null,
    rideKmWeek: acts.filter((a) => a.type === "RIDE" && within(a, 28)).reduce((s, a) => s + a.distanceM, 0) / 4000,
    hikeElevMonth: acts.filter((a) => a.type === "HIKE" && within(a, 30)).reduce((s, a) => s + a.elevationGainM, 0),
    gymWeek: acts.filter((a) => a.type === "WORKOUT" && within(a, 28)).length / 4,
    activeDaysWeek: new Set(acts.filter((a) => within(a, 28)).map((a) => dayKey(a.startedAt, tz))).size / 4,
  };
}

const phi = (z: number) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };

export function benchRows(p: { age: string; sex: string }, r: ReturnType<typeof recentStats>) {
  const v = VOL[p.age] ?? 1, pa = PACE[p.age] ?? 1, F = p.sex === "F";
  const rows: { label: string; value: number; median: number; unit: string; low?: boolean }[] = [
    { label: "Course : km par semaine", value: r.runKmWeek, median: 18 * v * (F ? 0.85 : 1), unit: "km" },
    ...(r.runPace ? [{ label: "Course : allure moyenne", value: r.runPace, median: (6.1 + (F ? 0.6 : 0)) * pa, unit: "min/km", low: true }] : []),
    { label: "Vélo : km par semaine", value: r.rideKmWeek, median: 45 * v * (F ? 0.75 : 1), unit: "km" },
    { label: "Rando : dénivelé par mois", value: r.hikeElevMonth, median: 1200 * v * (F ? 0.9 : 1), unit: "m" },
    { label: "Musculation : séances par semaine", value: r.gymWeek, median: 2, unit: "" },
    { label: "Jours actifs par semaine", value: r.activeDaysWeek, median: 3.2, unit: "" },
  ];
  return rows.map((x) => ({ ...x, pct: Math.round(phi(x.low ? (x.median - x.value) / (0.12 * x.median) : (x.value - x.median) / (0.4 * x.median)) * 100) }));
}
