import { dayKey, localHour, shiftDay, weekKeys } from "../dates";
import { sunTimes } from "./sun";
import { climbCompare, distanceCompare, tonnageCompare } from "./landmarks";
import type { Act, Insight, Story } from "./types";

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

export type StoryCtx = { tz: string; lifetimeKmBefore?: number; pr?: { label: string } | null };

/** Une phrase par sortie, choisie par priorité, avec plusieurs variantes pour ne pas radoter. */
export function activityStory(a: Act, history: Act[], { tz, lifetimeKmBefore, pr }: StoryCtx): Story {
  const km = a.distanceM / 1000, seed = a.id;

  if (pr) {
    const rain = (a.weather?.precipMm ?? 0) >= 1;
    const wd = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: tz }).format(a.startedAt);
    return { tag: "pr", text: rain ? `Record personnel sur ${pr.label}… et c’était un ${wd} pluvieux.` : pick([`Nouveau record sur ${pr.label}. Savourez, il est bien mérité.`, `Record personnel sur ${pr.label}. Ce jour-là, vous étiez plus rapide que jamais.`], seed) };
  }

  if (lifetimeKmBefore != null) {
    const t = [100, 250, 500, 1000, 2000, 5000, 10000].find((x) => lifetimeKmBefore < x && lifetimeKmBefore + km >= x);
    if (t) return { tag: "milestone", text: `Cap des ${fr(t)} km cumulés franchi. Ça commence à faire un sacré voyage.` };
  }

  const days = new Set([...history, a].map((x) => dayKey(x.startedAt, tz)));
  let n = 0, k = dayKey(a.startedAt, tz);
  while (days.has(k)) { n++; k = shiftDay(k, -1); }
  if (n >= 3) return { tag: "streak", text: `${n}ème sortie de suite. La régularité commence à payer.` };

  if (a.startLat != null && a.startLng != null) {
    const s = sunTimes(a.startedAt, a.startLat, a.startLng);
    if (s) {
      const start = a.startedAt.getTime(), end = start + a.movingTimeS * 1000;
      if (Math.abs(end - s.sunset.getTime()) <= 25 * 60e3) return { tag: "sunset", text: "Vous avez terminé votre sortie pile pendant le coucher de soleil. Classe." };
      if (Math.abs(start - s.sunrise.getTime()) <= 30 * 60e3) return { tag: "sunrise", text: "Départ au lever du soleil. Le monde était encore à vous." };
    }
  }

  const cl = climbCompare(a.elevationGainM, seed);
  if (cl) return { tag: "climb", text: pick([`${fr(a.elevationGainM)} m de D+ : ${cl.text}. Les jambes s’en souviendront.`, `Dénivelé du jour : ${cl.text}. Pas mal pour une sortie.`, `Vous avez grimpé ${cl.text}.`], seed) };
  if (a.movingTimeS >= 7200) return { tag: "long", text: `${hm(a.movingTimeS)} dehors. Mention spéciale pour la patience.` };

  const h = localHour(a.startedAt, tz);
  if (h < 7) return { tag: "early", text: "Pendant que la ville dormait encore, vous étiez déjà en route." };
  if (h >= 21) return { tag: "night", text: "Sortie de nuit. Les rues sont à vous, et il n’y a personne pour vous voir sourire." };

  return { tag: "generic", text: pick([`${fr(km, 1)} km de plus au compteur. Chaque sortie compte, même les ordinaires.`, `${hm(a.movingTimeS)} pour vous, et personne d’autre. Bien joué.`, `Une de plus dans la boîte. La régularité fait le reste.`], seed) };
}


/** Anecdote d'une séance de musculation : tonnage soulevé avec un repère imagé, sinon le nombre de séries. */
export function workoutStory(w: { volumeKg: number; exercises: number; sets: number }, seed: string): Story {
  const t = tonnageCompare(w.volumeKg, seed);
  if (t) return { tag: "tonnage", text: `${fr(w.volumeKg / 1000, 1)} t soulevées en une séance : ${t}.` };
  return { tag: "workout", text: pick([`${w.sets} séries sur ${w.exercises} exercice${w.exercises > 1 ? "s" : ""}. Du solide.`, `Séance bouclée : ${w.sets} séries, rien n’a été lâché.`], seed) };
}
