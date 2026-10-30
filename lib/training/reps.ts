/**
 * Fractionné : répétitions d'une sortie (découpage d'Intervals.icu, /api/activity/{id}/intervals, lu dans Chrome par
 * scripts/tampermonkey-intervals-streams.js) comparées aux allures cibles de la séance du programme (VMA du jour de la sortie).
 * Fonctions pures, sans accès base (tests : tools/test-reps.ts). Accès base : lib/data/reps.ts.
 */
import type { RunWorkoutStructure } from "@/types/training";
import { paceSPerKm, resolveSteps } from "./resolve";

/** Séances du programme découpées en répétitions : on va chercher leur découpage sur Intervals.icu. */
export const INTERVAL_KINDS: readonly string[] = ["INTERVALS_SHORT", "INTERVALS_LONG", "THRESHOLD", "RACE_PACE", "FARTLEK", "HILLS", "VMA_TEST"];
export const isRepSession = (s: { kind: string; isKeySession: boolean } | null | undefined) => !!s && (s.isKeySession || INTERVAL_KINDS.includes(s.kind));

// ───────── Réception (validation stricte) ─────────

/** Intervalle d'Intervals.icu, réduit aux champs lus par Pulse (le reste de la réponse est ignoré). */
export type IcuInterval = {
  type: string; start_index: number; end_index: number;
  start_time: number | null; distance: number | null; moving_time: number | null; average_speed: number | null; average_heartrate: number | null;
};

export const MAX_INTERVALS = 500;
const MAX_INDEX = 50_000; // même plafond que les courbes (~14 h à 1 Hz)

/** [champ, max] des nombres facultatifs (null accepté) ; tous ≥ 0. */
const OPTIONAL: [keyof IcuInterval, number][] = [
  ["start_time", 86_400], ["distance", 100_000], ["moving_time", 86_400], ["average_speed", 15], ["average_heartrate", 250],
];

/**
 * Corps `intervals` reçu du script : la réponse d'Intervals { icu_intervals: [...] } (icu_groups et autres champs ignorés).
 * Le moindre champ invalide rejette le tout (message d'erreur) : rien n'est enregistré à moitié.
 */
export function parseIntervals(body: unknown): IcuInterval[] | string {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "intervals : objet attendu";
  const list = (body as { icu_intervals?: unknown }).icu_intervals;
  if (!Array.isArray(list)) return "intervals : icu_intervals attendu (tableau)";
  if (list.length > MAX_INTERVALS) return `intervals : plus de ${MAX_INTERVALS} intervalles`;
  const out: IcuInterval[] = [];
  for (const [i, raw] of list.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return `intervals[${i}] : objet attendu`;
    const x = raw as Record<string, unknown>;
    if (typeof x.type !== "string" || !/^[A-Z_]{1,20}$/.test(x.type)) return `intervals[${i}] : type invalide`;
    const idx = (k: "start_index" | "end_index") => (Number.isInteger(x[k]) && (x[k] as number) >= 0 && (x[k] as number) <= MAX_INDEX ? (x[k] as number) : null);
    const start = idx("start_index"), end = idx("end_index");
    if (start == null || end == null || end < start) return `intervals[${i}] : start_index / end_index invalides`;
    const iv: IcuInterval = { type: x.type, start_index: start, end_index: end, start_time: null, distance: null, moving_time: null, average_speed: null, average_heartrate: null };
    for (const [k, max] of OPTIONAL) {
      const v = x[k];
      if (v == null) continue;
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > max) return `intervals[${i}] : ${k} invalide`;
      (iv as Record<string, unknown>)[k] = v;
    }
    out.push(iv);
  }
  return out;
}

// ───────── Résumé enregistré (Activity.workReps) ─────────

/** Une répétition : départ (s depuis le début), distance (m), temps en mouvement (s), FC moyenne. */
export type WorkRep = { s: number; d: number; t: number; hr?: number };
export type WorkReps = { v: 1; reps: WorkRep[] };

/** Répétitions WORK dans l'ordre, avec distance et temps exploitables (distance tirée de la vitesse moyenne à défaut). Null sans aucune. */
export function workRepsOf(intervals: IcuInterval[]): WorkReps | null {
  const reps = intervals
    .filter((iv) => iv.type === "WORK")
    .sort((a, b) => a.start_index - b.start_index)
    .flatMap((iv): WorkRep[] => {
      const t = iv.moving_time ?? 0, d = iv.distance && iv.distance > 0 ? iv.distance : (iv.average_speed ?? 0) * t;
      if (t < 5 || d < 20) return []; // intervalle vide (tapis sans distance, appui de tour parasite)
      return [{ s: Math.round(iv.start_time ?? iv.start_index), d: Math.round(d), t: Math.round(t), ...(iv.average_heartrate ? { hr: Math.round(iv.average_heartrate) } : {}) }];
    });
  return reps.length ? { v: 1, reps } : null;
}

/** Lecture tolérante de la colonne JSON (null si absente ou d'une autre forme). */
export function readWorkReps(json: unknown): WorkReps | null {
  const r = json as WorkReps | null;
  if (!r || r.v !== 1 || !Array.isArray(r.reps)) return null;
  const reps = r.reps.filter((x) => x && Number.isFinite(x.d) && Number.isFinite(x.t) && x.d > 0 && x.t > 0);
  return reps.length ? { v: 1, reps } : null;
}

// ───────── Comparaison au programme ─────────

/** Écart toléré autour de la fourchette (s/km), comme les comparaisons d'allure de la fiche : en dessous, c'est du bruit GPS. */
export const PACE_TOLERANCE_S = 3;

/** Fourchette d'allure (s/km) : `min` = la plus rapide. */
export type PaceTarget = { min: number; max: number };
export type RepStatus = "ok" | "slow" | "fast";
export type RepReview = WorkRep & {
  n: number; paceS: number;
  /** Cible de la répétition (s/km) et allure affichée au programme (milieu de la fourchette). */
  target: (PaceTarget & { mid: number }) | null;
  /** Écart à l'allure affichée (s/km) : + = plus lent. Null sans cible. */
  deltaS: number | null;
  status: RepStatus | null;
};
export type RepsReview = {
  reps: RepReview[];
  counts: { ok: number; slow: number; fast: number; rated: number };
  vmaKmh: number | null;
};

/** Cibles d'allure des étapes « effort » de la séance, dans l'ordre, répétitions déroulées (null : étape sans allure, ex. ressenti). */
export function plannedTargets(structure: RunWorkoutStructure | null | undefined, vmaKmh: number): (PaceTarget | null)[] {
  if (!structure?.steps?.length || !(vmaKmh > 0)) return [];
  return resolveSteps(structure, vmaKmh).filter((s) => s.role === "active").map((s) => s.paceSPerKm ?? null);
}

/**
 * Cible de la i-ième répétition. Même nombre de répétitions que d'étapes « effort » : une à une. Sinon (tour en trop, séance
 * écourtée) : la cible commune si toutes les étapes ont la même, sinon une à une tant qu'il y en a, puis rien.
 */
function targetFor(targets: (PaceTarget | null)[], i: number, count: number): PaceTarget | null {
  if (!targets.length) return null;
  if (targets.length === count) return targets[i];
  const first = targets[0], same = targets.every((t) => t && first && t.min === first.min && t.max === first.max);
  return same ? first : targets[i] ?? null;
}

export function statusOf(paceS: number, t: PaceTarget): RepStatus {
  if (paceS < t.min - PACE_TOLERANCE_S) return "fast";
  if (paceS > t.max + PACE_TOLERANCE_S) return "slow";
  return "ok";
}

/** Chaque répétition face à sa cible : dans la cible, trop lente, trop rapide, avec l'écart en s/km à l'allure affichée. */
export function reviewReps(work: WorkReps, targets: (PaceTarget | null)[], vmaKmh: number | null = null): RepsReview {
  const counts = { ok: 0, slow: 0, fast: 0, rated: 0 };
  const reps = work.reps.map((r, i): RepReview => {
    const paceS = r.t / (r.d / 1000), t = targetFor(targets, i, work.reps.length);
    if (!t) return { ...r, n: i + 1, paceS, target: null, deltaS: null, status: null };
    const mid = (t.min + t.max) / 2, status = statusOf(paceS, t);
    counts[status]++; counts.rated++;
    return { ...r, n: i + 1, paceS, target: { ...t, mid }, deltaS: Math.round(paceS - mid), status };
  });
  return { reps, counts, vmaKmh };
}

/** Allure cible affichée pour une VMA et un % (utile aux tests et aux libellés). */
export const targetPace = (vmaKmh: number, pctMin: number, pctMax: number): PaceTarget => ({ min: paceSPerKm(vmaKmh, pctMax), max: paceSPerKm(vmaKmh, pctMin) });
