/**
 * Analyse de la musculation : volume, progression par exercice, régularité, phrases « à retenir ».
 * La page Analyse l'appelle quand le sport choisi est la muscu. buildStrengthAnalysis est pure (tests : tools/test-strength.ts) ;
 * la progression suit les règles Lafay (total de reps, variante suivante) avec les codes de lib/muscles.ts.
 */
import { prisma } from "../prisma";
import { dayKey, shiftDay, weekKeys } from "../dates";
import type { SetDetail } from "../exercises";
import { musclesOf, UPPER_GROUPS } from "../muscles";
import { muscleVolume, type MuscleId, type MuscleLoad } from "../workout/body";
import { lafayView } from "../workout/lafay";
import { capOf, doneSets, groupKey, isJump, nextVariant, sumReps, variantOf, type Det, type Entry, type StrengthRow } from "./strength-rows";

export { capOf, doneSets, entriesOf, groupKey, isJump, nextVariant, sumReps, variantOf, type Entry, type StrengthRow } from "./strength-rows";
/** En dessous, pas assez de séances sur la période pour juger une progression ou un équilibre haut / bas. */
export const MIN_SESSIONS = 3;
export type StrengthStatus = "progress" | "stall1" | "stall2" | "evolve";
export type ExerciseProgress = {
  key: string; name: string;
  variant: string | null;          // « B2 », « B » (forme finale) pour un code Lafay à échelle, sinon null
  level: string;                   // « 6 × 11 » : cible de la prochaine séance (lib/workout/lafay.ts, la même que « Démarrer » et la page Programme)
  status: StrengthStatus;          // progrès / blocage 1 (une séance sans progrès) / blocage 2 (deux de suite ou plus) / à faire évoluer (plafond atteint)
  sessions: number;
  repsPerSession: number[];        // du plus ancien au plus récent
  hardPerSession: number[];        // mêmes séances : séries marquées « Dur » au SetLogger (ressenti, pour le coach)
  points: { day: string; reps: number; variant: string | null }[]; // mêmes séances, avec leur jour et leur variante (B1 → B2 : le changement se lit ici)
  lastDay: string;                 // AAAA-MM-JJ
  hint: string | null;             // conseil quand l'exercice est en blocage 2 ou à faire évoluer
  nextVariant: string | null;      // variante suivante (plus difficile) de l'échelle, null si dernière ou inconnue
  restartTarget: number | null;    // répétitions visées pour repartir : arrondi(N × 0,7)
};
export type StrengthAnalysis = {
  empty: boolean;
  summary: { sessions: number; sets: number; reps: number; tonnage: number | null };
  weekly: { weekStart: string; reps: number; sets: number; sessions: number }[];
  exercises: ExerciseProgress[];
  regularity: { perWeek: number; target: readonly [number, number]; upperPct: number | null; lowerPct: number | null };
  insights: string[];
  /** Volume par muscle de la carte du corps sur la période (lib/workout/body.ts) : descriptif, affiché dès une séance (le seuil MIN_SESSIONS ne vaut que pour juger). */
  muscles: Record<MuscleId, MuscleLoad>;
  /** Période précédente de même durée (null si l'historique chargé ne la couvre pas). */
  prev: { sessions: number; reps: number } | null;
};

const TARGET = [2, 3] as const;
const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (a: number, b: number) => Math.round((a / b) * 100);

/** Progrès = total supérieur à la séance précédente de la même variante, ou toutes les séries à la cible. Première séance d'une variante : progrès. */
export function stallsOf(entries: Entry[]): number {
  const run: Entry[] = []; // séances consécutives de la variante actuelle
  for (const e of entries) { if (e.variant !== entries[0].variant) break; run.push(e); }
  let n = 0;
  for (let i = 0; i < run.length; i++) {
    const prev = run[i + 1];
    if (!prev || run[i].total > prev.total || run[i].met) break;
    n++;
  }
  return n;
}
export function advice(e: Entry, name: string): { hint: string; next: string | null; restart: number } {
  const restart = Math.round(e.n * 0.7), next = nextVariant(e.variant);
  if (isJump(name) && e.n >= capOf(name)) return { hint: "saute plus haut", next: null, restart };
  return { hint: next ? `passe à ${next} à ${e.sets}×${restart}` : `repars à ${e.sets}×${restart} sur ${e.variant ?? "le même exercice"}`, next, restart };
}

/** `setsOf` : séries prévues d'un exercice (clé de groupe → séries du programme) ; à défaut, celles de sa dernière séance. */
export function buildStrengthAnalysis(rows: StrengthRow[], weeks: number, tz: string, now = new Date(), setsOf?: (key: string) => number | undefined, bodyKg = 70): StrengthAnalysis {
  const mon = weekKeys(now, tz)[0], first = shiftDay(mon, -7 * (weeks - 1));
  const weekOf = (d: Date) => Math.floor((Date.parse(dayKey(d, tz)) - Date.parse(first)) / (7 * 864e5)); // < 0 avant la période
  const inPeriod = rows.filter((r) => weekOf(r.startedAt) >= 0 && doneSets(r).length > 0);
  const inPrev = rows.filter((r) => { const w = weekOf(r.startedAt); return w >= -weeks && w < 0 && doneSets(r).length > 0; });
  const sorted = [...rows].sort((a, b) => +b.startedAt - +a.startedAt);

  // 1. Résumé
  const all = inPeriod.flatMap((r) => doneSets(r));
  const loaded = all.filter((s) => (s.loadKg ?? 0) > 0);
  const summary = {
    sessions: new Set(inPeriod.map((r) => r.activityId)).size,
    sets: all.length, reps: sumReps(all),
    tonnage: loaded.length ? loaded.reduce((s, x) => s + x.reps * x.loadKg!, 0) : null,
  };

  // 2. Volume par semaine (les semaines vides restent à 0 : l'axe est continu)
  const weekly = Array.from({ length: weeks }, (_, i) => ({ weekStart: shiftDay(first, 7 * i), reps: 0, sets: 0, ids: new Set<string>() }));
  for (const r of inPeriod) { const w = weekly[weekOf(r.startedAt)], d = doneSets(r); if (w) { w.reps += sumReps(d); w.sets += d.length; w.ids.add(r.activityId); } }

  // 3. Progression par exercice, sur tout l'historique chargé
  const by = new Map<string, StrengthRow[]>();
  for (const r of sorted) { const k = groupKey(r.name); if (k) by.set(k, [...(by.get(k) ?? []), r]); }
  const exercises: ExerciseProgress[] = [];
  for (const [key, list] of by) {
    if (!list.some((r) => weekOf(r.startedAt) >= 0 && doneSets(r).length > 0)) continue;
    // États, cible et conseil : lib/workout/lafay.ts (lafayView), la même règle que la séance proposée et la page Programme.
    const last = list[0], v = lafayView(list, setsOf?.(key)), t = v.target;
    if (!t) continue;
    const evolve = t.change === "evolve" || (t.change === "repeat" && t.hint === "saute plus haut");
    const reset = t.change === "evolve" || t.change === "restart";
    const perSession = new Map<string, { day: string; reps: number; variant: string | null; hard: number }>();
    for (const r of [...list].reverse()) if (weekOf(r.startedAt) >= 0) { const o = perSession.get(r.activityId); perSession.set(r.activityId, { day: dayKey(r.startedAt, tz), reps: (o?.reps ?? 0) + sumReps(doneSets(r)), variant: variantOf(r.name), hard: (o?.hard ?? 0) + doneSets(r).filter((d) => d.hard).length }); }
    exercises.push({
      key, name: last.name.trim(), variant: variantOf(last.name), level: `${t.sets} × ${t.reps}`,
      status: evolve ? "evolve" : v.state === "stall2" ? "stall2" : v.state === "stall1" ? "stall1" : "progress",
      sessions: perSession.size, repsPerSession: [...perSession.values()].map((x) => x.reps), hardPerSession: [...perSession.values()].map((x) => x.hard), points: [...perSession.values()].map(({ day, reps, variant }) => ({ day, reps, variant })), lastDay: dayKey(last.startedAt, tz),
      hint: evolve || v.state === "stall2" ? t.hint : null, nextVariant: t.change === "evolve" ? t.variant : null, restartTarget: reset ? t.reps : null,
    });
  }
  exercises.sort((a, b) => b.lastDay.localeCompare(a.lastDay));

  // 4. Régularité : on écarte la semaine en cours (incomplète) de la moyenne dès qu'il y en a une terminée
  const counted = weeks > 1 ? weekly.slice(0, -1) : weekly;
  let up = 0, low = 0;
  for (const r of inPeriod) {
    const best = [...musclesOf(r.name)].sort((a, b) => b[1] - a[1])[0];
    if (best) (UPPER_GROUPS.has(best[0]) ? (up += doneSets(r).length) : (low += doneSets(r).length));
  }
  const regularity = {
    perWeek: counted.reduce((s, w) => s + w.ids.size, 0) / counted.length, target: TARGET,
    upperPct: up + low ? pct(up, up + low) : null, lowerPct: up + low ? 100 - pct(up, up + low) : null,
  };

  return {
    empty: inPeriod.length === 0, summary,
    weekly: weekly.map((w) => ({ weekStart: w.weekStart, reps: w.reps, sets: w.sets, sessions: w.ids.size })),
    exercises, regularity, insights: insightsOf(rows, exercises, weekOf, weeks, tz, summary.sessions >= MIN_SESSIONS),
    muscles: muscleVolume(inPeriod.flatMap((r) => doneSets(r).map((x) => ({ name: r.name, sets: 1, reps: x.reps, loadKg: x.loadKg }))), bodyKg),
    prev: inPrev.length ? { sessions: new Set(inPrev.map((r) => r.activityId)).size, reps: inPrev.reduce((s, r) => s + sumReps(doneSets(r)), 0) } : null,
  };
}

/** 2 à 3 phrases tirées des données ; une phrase manque quand les données ne la permettent pas. */
function insightsOf(rows: StrengthRow[], exercises: ExerciseProgress[], weekOf: (d: Date) => number, weeks: number, tz: string, judge: boolean): string[] {
  const out: string[] = [];
  // Plus forte hausse de répétitions : 4 dernières semaines contre les 4 précédentes (au moins 20 reps avant, pour ne pas fêter 2 → 6)
  const cur = new Map<string, number>(), prev = new Map<string, number>(), names = new Map<string, string>();
  for (const r of [...rows].sort((a, b) => +a.startedAt - +b.startedAt)) {
    const w = weekOf(r.startedAt) - (weeks - 4), k = groupKey(r.name);
    if (w < -4) continue;
    const target = w >= 0 ? cur : prev;
    target.set(k, (target.get(k) ?? 0) + sumReps(doneSets(r))); names.set(k, r.name.trim());
  }
  const up = [...cur].map(([k, c]) => ({ k, c, p: prev.get(k) ?? 0 })).filter((x) => x.p >= 20 && x.c > x.p).sort((a, b) => b.c / b.p - a.c / a.p)[0];
  if (up && judge) out.push(`${exerciseLabel(up.k, names.get(up.k)!)} : +${pct(up.c - up.p, up.p)} % de répétitions sur 4 semaines (${up.p} → ${up.c}).`);

  const stuck = exercises.find((e) => e.status === "stall2");
  if (stuck && judge) {
    const n = `${stuck.name}${stuck.variant && !stuck.name.toUpperCase().startsWith(stuck.variant) ? ` (${stuck.variant})` : ""}`;
    out.push(`${n} est bloqué depuis 2 séances : ${stuck.hint}.`);
  }

  // Meilleure série de la période : la plus lourde (charge × reps) s'il y a des charges, sinon la plus longue
  let best: { r: StrengthRow; s: Det; score: number } | null = null;
  const inP = rows.filter((r) => weekOf(r.startedAt) >= 0), anyLoad = inP.some((r) => doneSets(r).some((s) => (s.loadKg ?? 0) > 0));
  for (const r of inP) for (const s of doneSets(r)) {
    const score = anyLoad ? ((s.loadKg ?? 0) > 0 ? s.reps * s.loadKg! : 0) : s.reps;
    if (score > (best?.score ?? 0)) best = { r, s, score };
  }
  if (best) out.push(`Meilleure série : ${(best.s.loadKg ?? 0) > 0 ? `${best.s.reps} × ${best.s.loadKg!.toLocaleString("fr-FR")} kg` : `${best.s.reps} répétitions`} sur ${best.r.name.trim()}, le ${lab(dayKey(best.r.startedAt, tz))}.`);
  return out.slice(0, 3);
}
const exerciseLabel = (k: string, name: string) => (k.startsWith("lafay:") ? name.trim().replace(/\s*[-–:.].*$/, "").toUpperCase() : name);

export async function getStrengthAnalysis(userId: string, tz: string, weeks: number, now = new Date(), setsOf?: (key: string) => number | undefined, bodyKg = 70): Promise<StrengthAnalysis> {
  // Deux périodes (comparaison avec la précédente), et au moins 8 semaines : la comparaison « 4 semaines contre 4 semaines » en a besoin
  const since = new Date(Date.parse(shiftDay(weekKeys(now, tz)[0], -7 * (Math.max(2 * weeks, 8) - 1))) - 864e5);
  const found = await prisma.workoutExercise.findMany({
    where: { activity: { userId, type: "WORKOUT", startedAt: { gte: since, lte: now } } },
    select: { activityId: true, name: true, sets: true, reps: true, loadKg: true, setsDetail: true, activity: { select: { startedAt: true } } },
  });
  const rows: StrengthRow[] = found.map((e) => ({
    activityId: e.activityId, startedAt: e.activity.startedAt, name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg,
    setsDetail: Array.isArray(e.setsDetail) ? (e.setsDetail as unknown as SetDetail[]) : null,
  }));
  return buildStrengthAnalysis(rows, weeks, tz, now, setsOf, bodyKg);
}
