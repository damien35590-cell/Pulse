/**
 * Analyse de la musculation : volume, progression par exercice, régularité, phrases « à retenir ».
 * La page Analyse l'appelle quand le sport choisi est la muscu. buildStrengthAnalysis est pure (tests : tools/test-strength.ts) ;
 * la progression suit les règles Lafay (total de reps, variante suivante) avec les codes de lib/muscles.ts.
 */
import { prisma } from "../prisma";
import { dayKey, shiftDay, weekKeys } from "../dates";
import { exerciseKey, type SetDetail } from "../exercises";
import { lafayCode, musclesOf } from "../muscles";

export type StrengthRow = { activityId: string; startedAt: Date; name: string; sets: number; reps: number; loadKg: number | null; setsDetail: SetDetail[] | null };
export type StrengthStatus = "progress" | "stall1" | "stall2" | "evolve";
export type ExerciseProgress = {
  key: string; name: string;
  variant: string | null;          // « B2 », « B » (forme finale) pour un code Lafay à échelle, sinon null
  level: string;                   // « 6×12 » : séries × répétitions visées à la dernière séance
  status: StrengthStatus;          // progrès / blocage 1 (une séance sans progrès) / blocage 2 (deux de suite ou plus) / à faire évoluer (plafond atteint)
  sessions: number;
  repsPerSession: number[];        // du plus ancien au plus récent
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
};

type Det = SetDetail & { isWarmup?: boolean };
const TARGET = [2, 3] as const;
/** Haut du corps / bas du corps + abdos, comme l'alternance Lafay du coach (lib/coach/today.ts). */
const UPPER = new Set(["pectoraux", "dorsaux", "épaules", "biceps", "triceps"]);
const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const pct = (a: number, b: number) => Math.round((a / b) * 100);

/** Séries réellement faites, échauffement exclu. Sans détail série par série, on suppose le prévu réalisé (comme progression.ts). */
function doneSets(r: StrengthRow): Det[] {
  if (!r.setsDetail) return Array.from({ length: r.sets }, () => ({ reps: r.reps, loadKg: r.loadKg, done: true }));
  return (r.setsDetail as Det[]).filter((s) => s.done && !s.isWarmup);
}
const sumReps = (sets: Det[]) => sets.reduce((s, x) => s + x.reps, 0);

/** Un exercice Lafay = sa lettre (B1 et B2 sont le même exercice à deux niveaux) ; sinon le nom normalisé. */
function groupKey(name: string) {
  const c = lafayCode(name);
  return c ? `lafay:${c.letter}` : exerciseKey(name);
}

/** Échelles Lafay, de la plus facile à la plus difficile. Une variante change l'exercice : le compteur de blocage repart de zéro. */
const LADDERS: string[][] = [["B1", "B2", "B"], ["C1", "C2", "C3", "C"], ["A1", "A2"], ["A3", "A4", "A5", "A6"]];
const nextVariant = (v: string | null) => { for (const l of LADDERS) { const i = l.indexOf(v ?? ""); if (i >= 0) return l[i + 1] ?? null; } return null; };
/** « B2 » ; « B » seul quand la lettre est la forme finale d'une échelle ; null pour les autres exercices. */
const variantOf = (name: string) => {
  const c = lafayCode(name);
  if (!c) return null;
  const v = c.digits != null ? `${c.letter.toUpperCase()}${c.digits}` : c.letter.toUpperCase();
  return LADDERS.some((l) => l.includes(v)) ? v : null;
};
/** Plafond de répétitions par série : 12, ou 20 pour F (squat sauté). */
const isJump = (name: string) => lafayCode(name)?.letter === "f" || /squat.*saut/i.test(name);
const capOf = (name: string) => (isJump(name) ? 20 : 12);

/** Une séance d'un exercice dans une variante : total de reps, cible N, toutes les séries à la cible ou plus. */
type Entry = { variant: string | null; total: number; n: number; sets: number; met: boolean };
function entriesOf(list: StrengthRow[]): Entry[] {
  const out: (Entry & { id: string })[] = [];
  for (const r of list) { // du plus récent au plus ancien
    const d = doneSets(r), variant = variantOf(r.name);
    if (!d.length) continue;
    const met = d.length >= r.sets && d.every((x) => x.reps >= r.reps), total = sumReps(d), same = out.find((e) => e.id === r.activityId && e.variant === variant);
    if (same) { same.total += total; same.met = same.met && met; } else out.push({ id: r.activityId, variant, total, n: r.reps, sets: r.sets, met });
  }
  return out;
}
/** Progrès = total supérieur à la séance précédente de la même variante, ou toutes les séries à la cible. Première séance d'une variante : progrès. */
function stallsOf(entries: Entry[]): number {
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
function advice(e: Entry, name: string): { hint: string; next: string | null; restart: number } {
  const restart = Math.round(e.n * 0.7), next = nextVariant(e.variant);
  if (isJump(name) && e.n >= capOf(name)) return { hint: "saute plus haut", next: null, restart };
  return { hint: next ? `passe à ${next} à ${e.sets}×${restart}` : `repars à ${e.sets}×${restart} sur ${e.variant ?? "le même exercice"}`, next, restart };
}

export function buildStrengthAnalysis(rows: StrengthRow[], weeks: number, tz: string, now = new Date()): StrengthAnalysis {
  const mon = weekKeys(now, tz)[0], first = shiftDay(mon, -7 * (weeks - 1));
  const weekOf = (d: Date) => Math.floor((Date.parse(dayKey(d, tz)) - Date.parse(first)) / (7 * 864e5)); // < 0 avant la période
  const inPeriod = rows.filter((r) => weekOf(r.startedAt) >= 0 && doneSets(r).length > 0);
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
    const ents = entriesOf(list), cur = ents[0] ?? { variant: null, total: 0, n: list[0].reps, sets: list[0].sets, met: false };
    const stalls = stallsOf(ents), last = list[0], evolve = cur.n >= capOf(last.name);
    const adv = stalls >= 2 || evolve ? advice(cur, last.name) : null;
    const perSession = new Map<string, number>();
    for (const r of [...list].reverse()) if (weekOf(r.startedAt) >= 0) perSession.set(r.activityId, (perSession.get(r.activityId) ?? 0) + sumReps(doneSets(r)));
    exercises.push({
      key, name: last.name.trim(), variant: cur.variant, level: `${cur.sets}×${cur.n}`,
      status: evolve ? "evolve" : stalls === 0 ? "progress" : stalls === 1 ? "stall1" : "stall2",
      sessions: perSession.size, repsPerSession: [...perSession.values()], lastDay: dayKey(last.startedAt, tz),
      hint: adv?.hint ?? null, nextVariant: adv?.next ?? null, restartTarget: adv?.restart ?? null,
    });
  }
  exercises.sort((a, b) => b.lastDay.localeCompare(a.lastDay));

  // 4. Régularité : on écarte la semaine en cours (incomplète) de la moyenne dès qu'il y en a une terminée
  const counted = weeks > 1 ? weekly.slice(0, -1) : weekly;
  let up = 0, low = 0;
  for (const r of inPeriod) {
    const best = [...musclesOf(r.name)].sort((a, b) => b[1] - a[1])[0];
    if (best) (UPPER.has(best[0]) ? (up += doneSets(r).length) : (low += doneSets(r).length));
  }
  const regularity = {
    perWeek: counted.reduce((s, w) => s + w.ids.size, 0) / counted.length, target: TARGET,
    upperPct: up + low ? pct(up, up + low) : null, lowerPct: up + low ? 100 - pct(up, up + low) : null,
  };

  return {
    empty: inPeriod.length === 0, summary,
    weekly: weekly.map((w) => ({ weekStart: w.weekStart, reps: w.reps, sets: w.sets, sessions: w.ids.size })),
    exercises, regularity, insights: insightsOf(rows, exercises, weekOf, weeks, tz),
  };
}

/** 2 à 3 phrases tirées des données ; une phrase manque quand les données ne la permettent pas. */
function insightsOf(rows: StrengthRow[], exercises: ExerciseProgress[], weekOf: (d: Date) => number, weeks: number, tz: string): string[] {
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
  if (up) out.push(`${exerciseLabel(up.k, names.get(up.k)!)} : +${pct(up.c - up.p, up.p)} % de répétitions sur 4 semaines (${up.p} → ${up.c}).`);

  const stuck = exercises.find((e) => e.status === "stall2");
  if (stuck) {
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

export async function getStrengthAnalysis(userId: string, tz: string, weeks: number, now = new Date()): Promise<StrengthAnalysis> {
  // Au moins 8 semaines d'historique : la comparaison « 4 semaines contre 4 semaines » en a besoin, même sur une période de 4
  const since = new Date(Date.parse(shiftDay(weekKeys(now, tz)[0], -7 * (Math.max(weeks, 8) - 1))) - 864e5);
  const found = await prisma.workoutExercise.findMany({
    where: { activity: { userId, type: "WORKOUT", startedAt: { gte: since } } },
    select: { activityId: true, name: true, sets: true, reps: true, loadKg: true, setsDetail: true, activity: { select: { startedAt: true } } },
  });
  const rows: StrengthRow[] = found.map((e) => ({
    activityId: e.activityId, startedAt: e.activity.startedAt, name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg,
    setsDetail: Array.isArray(e.setsDetail) ? (e.setsDetail as unknown as SetDetail[]) : null,
  }));
  return buildStrengthAnalysis(rows, weeks, tz, now);
}
