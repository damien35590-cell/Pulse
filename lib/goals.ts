import { dayKey, weekKeys } from "./dates";

export type Act = { startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; type: string };
export const METRICS = {
  DISTANCE: { label: "Distance", unit: "km", base: 1000, f: (a: Act) => a.distanceM },
  TIME: { label: "Temps", unit: "h", base: 3600, f: (a: Act) => a.movingTimeS },
  ELEVATION: { label: "Dénivelé +", unit: "m", base: 1, f: (a: Act) => a.elevationGainM },
  ACTIVITIES: { label: "Séances", unit: "séances", base: 1, f: () => 1 },
} as const;
export const PERIODS = { WEEK: "cette semaine", MONTH: "ce mois-ci", YEAR: "cette année" } as const;
export type Metric = keyof typeof METRICS; export type Period = keyof typeof PERIODS;

/** Progression d'un objectif sur la période en cours, avec projection « à ce rythme ». */
export function goalProgress(g: { metric: Metric; period: Period; target: number; type: string | null }, acts: Act[], now: Date, tz: string) {
  const today = dayKey(now, tz), wk = weekKeys(now, tz);
  const inP = (k: string) => g.period === "WEEK" ? wk.includes(k) : g.period === "MONTH" ? k.slice(0, 7) === today.slice(0, 7) : k.slice(0, 4) === today.slice(0, 4);
  const m = METRICS[g.metric];
  const value = acts.filter((a) => (!g.type || a.type === g.type) && inP(dayKey(a.startedAt, tz))).reduce((s, a) => s + m.f(a), 0) / m.base;
  const [y, mo, d] = today.split("-").map(Number);
  const elapsed = g.period === "WEEK" ? (wk.indexOf(today) + 1) / 7 : g.period === "MONTH" ? d / new Date(y, mo, 0).getDate() : (Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 864e5 / 365;
  const target = g.target / m.base, projected = value / elapsed;
  return { value, target, pct: Math.min(100, (value / target) * 100), elapsed, projected, onTrack: projected >= target, done: value >= target };
}
