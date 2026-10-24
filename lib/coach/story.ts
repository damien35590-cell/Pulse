/**
 * Anecdote d'une activité (Activity.story), affichée sous le titre de la carte. Une seule ligne, sobre et factuelle (doctrine : lib/coach/doctrine.ts),
 * qui n'ajoute que ce que les 3 chiffres de la carte ne disent pas : jamais distance, durée ni allure.
 * Priorité : record personnel (« Bravo » autorisé ici seulement) > série > écart à la moyenne des 30 jours > rien (null).
 * Activités douces (E-bike, marche) et vélotaf : jamais d'anecdote, jamais comptées dans les séries.
 * `buildStory` est pure ; `storyForActivity` lit la base. Toutes les écritures passent par là : lib/pipeline/post-import.ts (import, synchros,
 * saisie manuelle, séances de muscu) et tools/regenerer-stories.ts.
 */
import { prisma } from "../prisma";
import { dayKey, shiftDay } from "../dates";
import { isCommute } from "../routes/estimate";
import { fmtNum, ordinalFr } from "../format";
import { comparisonFor, type Scale } from "./comparisons";
import { verdictForActivity } from "./session-comment";

export type StoryKind = "record" | "milestone" | "streak" | "comparison";
export type Story = { kind: StoryKind; text: string };

export const STREAK_MIN = 3;
export const GAP_MIN_PCT = 3;
const WINDOW_DAYS = 30;

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = <T>(id: string, xs: T[]) => xs[hash(id) % xs.length];

/** Nom du sport : rando, séance (muscu), sortie (course, vélo). */
export const sportNoun = (type: string) => (type === "HIKE" ? "rando" : type === "WORKOUT" ? "séance" : "sortie");

const mmss = (s: number) => { const r = Math.round(s); return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`; };
const hms = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(Math.round(s % 60)).padStart(2, "0")}` : mmss(s));

export type RecordFact = { kind: "BEST_5K" | "BEST_10K" | "BEST_HALF" | "LONGEST_DISTANCE" | "LONGEST_TIME" | "BEST_ELEVATION" | "REPS"; value?: number; text?: string };
const RECORD_LABEL: Record<string, string> = { BEST_5K: "5 km", BEST_10K: "10 km", BEST_HALF: "semi-marathon" };
const RECORD_NOUN: Record<string, string> = { LONGEST_DISTANCE: "de distance", LONGEST_TIME: "de durée", BEST_ELEVATION: "de dénivelé" };
const RECORD_RANK = ["BEST_10K", "BEST_5K", "BEST_HALF", "REPS", "BEST_ELEVATION", "LONGEST_DISTANCE", "LONGEST_TIME"];

/** Record : seul endroit où « Bravo » est permis. */
export function recordText(r: RecordFact, type: string): string {
  if (r.kind === "REPS") return `${r.text} Bravo.`;
  if (RECORD_LABEL[r.kind]) return `Record personnel sur ${RECORD_LABEL[r.kind]} : ${hms(r.value ?? 0)}. Bravo.`;
  const where = type === "RIDE" ? "à vélo" : type === "HIKE" ? "en rando" : type === "RUN" ? "en course" : "en activité";
  return `Record personnel ${RECORD_NOUN[r.kind]} ${where}. Bravo.`;
}

export function streakText(id: string, type: string, n: number): string {
  const noun = sportNoun(type), ord = ordinalFr(n);
  return pick(id, [
    `${ord} ${noun} d'affilée.`,
    `${ord} ${noun} consécutive.`,
    `Série en cours : ${n} jours consécutifs d'activité.`,
    `${ord} jour d'activité consécutif.`,
  ]);
}

export type Metric = "Allure" | "Vitesse" | "D+" | "Répétitions totales";
export function comparisonText(id: string, metric: Metric, gapPct: number): string {
  const p = Math.round(Math.abs(gapPct)), up = gapPct > 0, sign = up ? "+" : "−";
  return pick(id, [
    `${metric} en ${up ? "hausse" : "baisse"} de ${p} % sur la moyenne des 30 derniers jours.`,
    `${metric} : ${sign}${p} % par rapport à la moyenne sur 30 jours.`,
    `Moyenne sur 30 jours : ${metric === "D+" ? "D+" : metric.toLowerCase()} ${sign}${p} %.`,
  ]);
}

export type Cur = { type: string; distanceM: number; movingTimeS: number; elevationGainM: number; reps: number };
export type Past = { distanceM: number; movingTimeS: number; elevationGainM: number; reps: number };

/** Écart relatif (%) à la moyenne des 30 jours, par indicateur disponible ; positif = mieux / plus. */
export function gaps(cur: Cur, past: Past[]): { metric: Metric; pct: number }[] {
  const out: { metric: Metric; pct: number }[] = [];
  const dist = past.reduce((s, a) => s + a.distanceM, 0), time = past.reduce((s, a) => s + a.movingTimeS, 0);
  const speedOk = cur.distanceM >= 1000 && cur.movingTimeS > 0 && dist > 0 && time > 0;
  const avgDplus = past.reduce((s, a) => s + a.elevationGainM, 0) / past.length;
  if (cur.type === "RUN" && speedOk) { const avg = time / (dist / 1000), now = cur.movingTimeS / (cur.distanceM / 1000); out.push({ metric: "Allure", pct: ((avg - now) / avg) * 100 }); }
  if (cur.type === "RIDE" && speedOk) { const avg = dist / 1000 / (time / 3600), now = cur.distanceM / 1000 / (cur.movingTimeS / 3600); out.push({ metric: "Vitesse", pct: ((now - avg) / avg) * 100 }); }
  if ((cur.type === "RIDE" || cur.type === "HIKE") && cur.elevationGainM > 0 && avgDplus > 0) out.push({ metric: "D+", pct: ((cur.elevationGainM - avgDplus) / avgDplus) * 100 });
  if (cur.type === "WORKOUT" && cur.reps > 0) { const avg = past.reduce((s, a) => s + a.reps, 0) / past.length; if (avg > 0) out.push({ metric: "Répétitions totales", pct: ((cur.reps - avg) / avg) * 100 }); }
  return out;
}

/** Historique du sport avant l'activité (toutes les sorties, pas seulement 30 jours). */
export type Hist = { distanceM: number; elevationGainM: number; movingTimeS: number };

export type StoryInput = {
  id: string; type: string; streakDays: number; records: RecordFact[]; cur: Cur; past: Past[];
  hist: Hist[]; tonnageKg: number;
  /** Textes des dernières anecdotes du sport (les plus récentes d'abord) : on n'y réutilise pas une référence de comparaison. */
  recent: string[];
};

export const TOP_SHARE = 0.05;
export const HIST_MIN = 20;
/** Paliers « première fois » : distance (km) et D+ (m). */
const MILESTONES: Record<string, { km: number[]; dplus: number[] }> = {
  RUN: { km: [10, 15, 21.1, 30, 42.2], dplus: [] },
  RIDE: { km: [50, 100, 150, 200], dplus: [1000, 2000, 3000] },
  HIKE: { km: [10, 20, 30, 40], dplus: [500, 1000, 1500, 2000] },
};

/** Ce qui rend l'activité exceptionnelle : sa phrase factuelle (si aucune autre) et l'échelle de la comparaison créative. */
type Why = { text: string | null; scale: Scale | null };
function exceptional(i: StoryInput, rec: RecordFact | undefined): Why | null {
  const noun = sportNoun(i.type), c = i.cur;
  const km = c.distanceM / 1000;
  // 1. Record
  if (rec) return { text: null, scale: rec.kind === "REPS" ? "mass" : rec.kind === "BEST_ELEVATION" ? "height" : "distance" };
  // 2. Première fois
  const m = MILESTONES[i.type];
  if (m && i.hist.length >= 10) {
    const maxKm = Math.max(0, ...i.hist.map((h) => h.distanceM / 1000)), maxD = Math.max(0, ...i.hist.map((h) => h.elevationGainM));
    const d = m.dplus.filter((t) => c.elevationGainM >= t && maxD < t).pop();
    if (d) return { text: `Première ${noun} à plus de ${fmtNum(d, 0)} m de D+.`, scale: "height" };
    const k = m.km.filter((t) => km >= t && maxKm < t).pop();
    if (k) return { text: `Première ${noun} de plus de ${fmtNum(k, 1)} km.`, scale: "distance" };
  }
  if (i.type === "WORKOUT" && i.hist.length >= 10 && c.movingTimeS > Math.max(...i.hist.map((h) => h.movingTimeS)))
    return { text: "Séance la plus longue enregistrée.", scale: i.tonnageKg >= 500 ? "mass" : null };
  // 3. Top 5 % de l'historique du sport
  if (i.hist.length + 1 >= HIST_MIN) {
    const n = i.hist.length + 1;
    const top = (v: number, f: (h: Hist) => number) => v > 0 && i.hist.filter((h) => f(h) >= v).length / n < TOP_SHARE;
    if (i.type !== "WORKOUT" && top(c.elevationGainM, (h) => h.elevationGainM)) return { text: `${cap(noun)} dans les 5 % les plus riches en dénivelé de l'historique.`, scale: "height" };
    if (i.type !== "WORKOUT" && top(c.distanceM, (h) => h.distanceM)) return { text: `${cap(noun)} dans les 5 % les plus longues en distance de l'historique.`, scale: "distance" };
    if (top(c.movingTimeS, (h) => h.movingTimeS)) return { text: `${cap(noun)} dans les 5 % les plus longues en durée de l'historique.`, scale: i.type === "WORKOUT" ? (i.tonnageKg >= 500 ? "mass" : null) : "distance" };
  }
  return null;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Phrase créative d'une activité exceptionnelle : valeur + comparaison (« 1 400 m de D+, soit 1,7 fois le Burj Khalifa. »). */
function creative(i: StoryInput, scale: Scale | null): string | null {
  if (!scale) return null;
  const value = scale === "height" ? i.cur.elevationGainM : scale === "distance" ? i.cur.distanceM / 1000 : i.tonnageKg;
  const cmp = comparisonFor(scale, value, i.id, i.recent);
  if (!cmp) return null;
  const shown = scale === "height" ? `${fmtNum(value, 0)} m de D+` : scale === "distance" ? `${fmtNum(value, 1)} km` : `Volume soulevé : ${value >= 1000 ? `${fmtNum(value / 1000, 1)} t` : `${fmtNum(value, 0)} kg`}`;
  return `${shown}, ${cmp}.`;
}

/** Fonction pure. `null` : rien de notable. */
export function buildStory(i: StoryInput): Story | null {
  const rec = [...i.records].sort((a, b) => RECORD_RANK.indexOf(a.kind) - RECORD_RANK.indexOf(b.kind))[0];
  const why = exceptional(i, rec);
  let base: Story | null = null;
  if (rec) base = { kind: "record", text: recordText(rec, i.type) };
  else if (i.streakDays >= STREAK_MIN) base = { kind: "streak", text: streakText(i.id, i.type, i.streakDays) };
  else if (i.past.length >= 3) {
    const g = gaps(i.cur, i.past).filter((x) => Math.abs(x.pct) >= GAP_MIN_PCT).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];
    if (g) base = { kind: "comparison", text: comparisonText(i.id, g.metric, g.pct) };
  }
  if (!why) return base;
  if (!base && why.text) base = { kind: "milestone", text: why.text };
  if (!base) return null;
  const extra = creative(i, why.scale);
  return extra ? { kind: base.kind, text: `${base.text} ${extra}` } : base;
}

type RecordRow = { kind: string; value: number; beaten: boolean };

/**
 * Anecdote d'une activité, lue en base. `records` : records battus à l'import (RecordUpdate) ; absent (régénération), on les déduit des records
 * actuellement détenus par l'activité, à condition qu'une sortie du même sport l'ait précédée. `opts.recent` : textes des dernières anecdotes du sport
 * (sinon lus en base), pour ne pas répéter une référence de comparaison ; la régénération en série les fournit dans l'ordre chronologique.
 */
export async function storyForActivity(activityId: string, records?: RecordRow[], opts: { recent?: string[] } = {}): Promise<Story | null> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { id: true, userId: true, type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true },
  });
  if (!a || isCommute(a)) return null;
  const tz = (await prisma.user.findUnique({ where: { id: a.userId }, select: { timezone: true } }))?.timezone ?? "Europe/Paris";

  let held = records;
  if (!held) {
    const mine = await prisma.personalRecord.findMany({ where: { activityId: a.id }, select: { kind: true, value: true } });
    const earlier = mine.length ? await prisma.activity.count({ where: { userId: a.userId, type: a.type, startedAt: { lt: a.startedAt } } }) : 0;
    held = mine.map((r) => ({ ...r, beaten: earlier > 0 }));
  }
  const recs: RecordFact[] = held.filter((r) => r.beaten && (a.type !== "WORKOUT" || r.kind === "REPS")).map((r) => ({ kind: r.kind as RecordFact["kind"], value: r.value }));
  if (a.type === "WORKOUT") {
    const v = await verdictForActivity(a.id, []);
    if (v?.kind === "record" && v.facts.recordReps != null)
      recs.push({ kind: "REPS", text: `Record de répétitions sur ${v.facts.exercise} : ${v.facts.recordReps} reps (+${v.facts.recordGain ?? 0}).` });
  }

  // Série : jours consécutifs avec une activité d'entraînement, jusqu'au jour de celle-ci.
  const days = await prisma.activity.findMany({
    where: { userId: a.userId, startedAt: { gte: new Date(+a.startedAt - 400 * 864e5), lte: a.startedAt } },
    select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true },
  });
  const active = new Set(days.filter((d) => !isCommute(d)).map((d) => dayKey(d.startedAt, tz)));
  let streakDays = 0;
  for (let k = dayKey(a.startedAt, tz); active.has(k); k = shiftDay(k, -1)) streakDays++;

  // Moyenne des 30 jours précédents, même sport.
  const prev = (await prisma.activity.findMany({
    where: { userId: a.userId, type: a.type, id: { not: a.id }, startedAt: { gte: new Date(+a.startedAt - WINDOW_DAYS * 864e5), lt: a.startedAt } },
    select: { id: true, title: true, source: true, dedupeKey: true, type: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true },
  })).filter((p) => !isCommute(p) && p.movingTimeS > 0);
  const repsOf = new Map<string, number>();
  let tonnageKg = 0;
  if (a.type === "WORKOUT") {
    const ex = await prisma.workoutExercise.findMany({ where: { activityId: { in: [a.id, ...prev.map((p) => p.id)] } }, select: { activityId: true, sets: true, reps: true, loadKg: true } });
    for (const e of ex) {
      repsOf.set(e.activityId, (repsOf.get(e.activityId) ?? 0) + e.sets * e.reps);
      if (e.activityId === a.id) tonnageKg += e.sets * e.reps * (e.loadKg ?? 0);
    }
  }
  const past = prev.map((p) => ({ distanceM: p.distanceM, movingTimeS: p.movingTimeS, elevationGainM: p.elevationGainM, reps: repsOf.get(p.id) ?? 0 }))
    .filter((p) => a.type !== "WORKOUT" || p.reps > 0);

  // Historique complet du sport (records « première fois » et top 5 %), et dernières anecdotes (références déjà citées).
  const hist = (await prisma.activity.findMany({
    where: { userId: a.userId, type: a.type, id: { not: a.id }, startedAt: { lt: a.startedAt } },
    select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true },
  })).filter((h) => !isCommute(h));
  const recent = opts.recent ?? (await prisma.activity.findMany({
    where: { userId: a.userId, type: a.type, story: { not: null }, startedAt: { lt: a.startedAt } },
    orderBy: { startedAt: "desc" }, take: 10, select: { story: true },
  })).map((r) => r.story!);

  return buildStory({
    id: a.id, type: a.type, streakDays, records: recs, past, hist, tonnageKg, recent,
    cur: { type: a.type, distanceM: a.distanceM, movingTimeS: a.movingTimeS, elevationGainM: a.elevationGainM, reps: repsOf.get(a.id) ?? 0 },
  });
}
