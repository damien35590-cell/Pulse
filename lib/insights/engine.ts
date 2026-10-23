import { dayKey, weekKeys } from "../dates";
import { climbCompare, distanceCompare } from "./landmarks";
import type { Act, Insight } from "./types";

const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = <T,>(a: T[], seed: string) => a[hash(seed) % a.length];
const sum = (a: Act[], f: (x: Act) => number) => a.reduce((s, x) => s + f(x), 0);
const hm = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
const pace = (a: Act[]) => sum(a, (x) => x.movingTimeS) / (sum(a, (x) => x.distanceM) / 1000); // s/km

export type WeeklyCtx = { now: Date; tz: string };

/** Insights de la semaine : chaque règle ne s'affiche que si elle a vraiment quelque chose à dire. */
export function weeklyInsights(acts: Act[], { now, tz }: WeeklyCtx): Insight[] {
  const wk = new Set(weekKeys(now, tz)), pw = new Set(weekKeys(now, tz, -1));
  const cur = acts.filter((a) => wk.has(dayKey(a.startedAt, tz)));
  const prev = acts.filter((a) => pw.has(dayKey(a.startedAt, tz)));
  const out: Insight[] = [];

  const climb = sum(cur, (a) => a.elevationGainM);
  const seed = weekKeys(now, tz)[0], cc = climbCompare(climb, seed);
  if (cc) out.push({ id: "climb", tone: "wow", icon: "mountain", title: cc.short, body: `${fr(climb)} m de D+ cette semaine : c’est ${cc.text}.` });

  const km = sum(cur, (a) => a.distanceM) / 1000, pkm = sum(prev, (a) => a.distanceM) / 1000;
  const dc = distanceCompare(km, seed);
  if (dc) out.push({ id: "distance", tone: "wow", icon: "zap", title: dc.short, body: `${fr(km, 1)} km cumulés depuis lundi : ${dc.text}.` });
  if (pkm > 0) {
    const pct = Math.round(((km - pkm) / pkm) * 100);
    if (pct >= 10) out.push({ id: "wow-week", tone: "progress", icon: "trend", title: `+${pct} % vs semaine dernière`, body: `${fr(km, 1)} km contre ${fr(pkm, 1)} km. Belle montée en puissance.` });
    else if (pct <= -25) out.push({ id: "calm-week", tone: "fun", icon: "clock", title: "Semaine plus calme", body: "Le repos fait aussi partie de l’entraînement. Le corps encaisse, il recharge." });
  }

  const runs = acts.filter((a) => a.type === "RUN" && a.distanceM >= 2000);
  const d30 = now.getTime() - 30 * 864e5, d60 = now.getTime() - 60 * 864e5;
  const recent = runs.filter((a) => a.startedAt.getTime() >= d30), before = runs.filter((a) => a.startedAt.getTime() < d30 && a.startedAt.getTime() >= d60);
  if (recent.length >= 3 && before.length >= 3) {
    const gain = pace(before) - pace(recent);
    if (gain >= 5) out.push({ id: "pace", tone: "progress", icon: "trend", title: `${Math.round(gain)} s de moins au km`, body: "Votre allure moyenne s’est améliorée en 30 jours. Ça ne se voit pas d’une sortie à l’autre, mais le chrono ne ment pas." });
  }

  const month = dayKey(now, tz).slice(0, 7);
  const mt = sum(acts.filter((a) => dayKey(a.startedAt, tz).startsWith(month)), (a) => a.movingTimeS);
  if (mt >= 3600) out.push({ id: "time", tone: "fun", icon: "clock", title: hm(mt), body: `en mouvement ce mois-ci.` });

  return out.slice(0, 5);
}
