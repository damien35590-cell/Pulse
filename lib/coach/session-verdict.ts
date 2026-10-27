/**
 * Verdict déterministe d'une séance terminée (course, vélo, musculation) : record, fatigue, sous-performance, contraintes ou cible validée.
 * Fonction pure (tests : tools/test-session-verdict.ts). Le texte vient de comment-templates.ts, jamais d'ici.
 * Vélotaf, marche et activités douces Google Fit : aucun verdict (null), donc aucun commentaire.
 */
import { isCommute, median } from "../routes/estimate";
import { entriesOf, stallsOf, type StrengthRow } from "../analytics/strength";
import { applyLafayProgress } from "../workout/lafay";

export type VerdictKind = "record" | "validated" | "underperformance" | "fatigue" | "constrained";
export type Sport = "RUN" | "RIDE" | "WORKOUT";

/** Seuils réglables. */
export const DECOUPLING_MAX_PCT = 5;
export const HR_DRIFT_BPM = 5;
export const PACE_TOLERANCE_S = 15;
export const RECENT_EF_COUNT = 5;
export const MIN_EF_SAMPLES = 3;
export const LATE_START_HOUR = 21;
export const MIN_DECOUPLING_S = 20 * 60;

export type TrackSample = { t: number; lat?: number; lng?: number; hr?: number };
/** Cible du plan pour la séance : fourchette d'allure (s/km) et/ou de fréquence cardiaque (bpm). */
export type PlanTarget = { label?: string; paceSKm?: [number, number]; hr?: [number, number] };
export type RecentRun = { paceSKm: number; avgHr: number };
export type StrengthExercise = {
  /** Lignes de CET exercice (même lettre), de la plus récente à la plus ancienne ; la première appartient à la séance commentée. */
  rows: StrengthRow[];
};

export type SessionInput = {
  type: string;
  title?: string | null; source?: string | null; dedupeKey?: string | null;
  /** Heure locale de début (0-23) et présence d'une autre séance d'entraînement plus tôt le même jour. */
  startHour: number;
  secondOfDay: boolean;
  feeling?: "GREAT" | "GOOD" | "OK" | "TIRED" | "HARD" | null;
  // Course / vélo
  distanceM?: number; movingTimeS?: number; avgHr?: number | null;
  /** Découplage FC/allure en % (champ Intervals.icu) ; sinon calculé sur `samples`. */
  decouplingPct?: number | null;
  samples?: TrackSample[];
  /** Records battus par cette sortie (meilleur temps 5 km, 10 km, semi…) : valeur en secondes. */
  records?: { label: string; timeS: number }[];
  /** Sorties course précédentes avec FC, de la plus récente à la plus ancienne. */
  recentRuns?: RecentRun[];
  plan?: PlanTarget | null;
  // Musculation
  workoutKind?: "HAUT" | "BAS" | "LIBRE" | null;
  exercises?: StrengthExercise[];
  /** Ceinture cardio : FC moyenne et max de la séance, baisse moyenne de FC pendant les repos (null s'il y a moins de 3 séries mesurées). */
  hr?: { avg: number; max: number; restDrop?: number | null } | null;
};

export type VerdictFacts = {
  sport: Sport;
  // record
  recordLabel?: string; recordTimeS?: number; recordReps?: number; recordGain?: number;
  // fatigue
  hrDriftBpm?: number; decouplingPct?: number; feeling?: "TIRED" | "HARD";
  // validated (course)
  planLabel?: string; paceRangeSKm?: [number, number]; hrInZone?: boolean;
  // validated / underperformance (muscu)
  sets?: number; exercises?: number;
  exercise?: string; totalReps?: number; deltaReps?: number; stall?: 0 | 1 | 2; blocked?: boolean; sessionLabel?: string | null;
  // constrained
  reason?: "late" | "second";
  // muscu avec ceinture cardio (s'ajoute au verdict, n'en crée pas)
  hrAvg?: number; hrMax?: number; hrRestDrop?: number;
};
export type Verdict = { kind: VerdictKind; facts: VerdictFacts };

const SPORTS: readonly string[] = ["RUN", "RIDE", "WORKOUT"];
const inRange = (v: number, [a, b]: [number, number]) => v >= a && v <= b;

/** Découplage FC/allure : baisse (en %) du rapport vitesse / FC entre la 1re et la 2e moitié de la sortie. Null si la trace est inexploitable. */
export function computeDecoupling(samples: TrackSample[]): number | null {
  const pts = samples.filter((p) => Number.isFinite(p.t)).sort((a, b) => a.t - b.t);
  if (pts.length < 10 || (pts[pts.length - 1].t - pts[0].t) / 1000 < MIN_DECOUPLING_S) return null;
  const mid = (pts[0].t + pts[pts.length - 1].t) / 2;
  const half = (list: TrackSample[]) => {
    const gps = list.filter((p) => p.lat != null && p.lng != null);
    let dist = 0;
    for (let i = 1; i < gps.length; i++) dist += hav(gps[i - 1], gps[i]);
    const hrs = list.map((p) => p.hr ?? 0).filter((h) => h > 0);
    const secs = list.length > 1 ? (list[list.length - 1].t - list[0].t) / 1000 : 0;
    return secs > 0 && hrs.length >= 5 && dist > 0 ? dist / secs / (hrs.reduce((s, h) => s + h, 0) / hrs.length) : null;
  };
  const e1 = half(pts.filter((p) => p.t <= mid)), e2 = half(pts.filter((p) => p.t > mid));
  return e1 && e2 ? ((e1 - e2) / e1) * 100 : null;
}
function hav(a: TrackSample, b: TrackSample) {
  const R = 6371000, r = Math.PI / 180, dLat = (b.lat! - a.lat!) * r, dLng = (b.lng! - a.lng!) * r;
  return 2 * R * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a.lat! * r) * Math.cos(b.lat! * r) * Math.sin(dLng / 2) ** 2));
}

type Strength = { record: VerdictFacts | null; under: VerdictFacts | null; met: VerdictFacts | null };
function strengthVerdicts(input: SessionInput): Strength {
  const out: Strength = { record: null, under: null, met: null };
  let worst = 0, bestGain = 0, sets = 0, count = 0, allMet = true;
  for (const { rows } of input.exercises ?? []) {
    const ents = entriesOf(rows), cur = ents[0];
    if (!cur) continue;
    count++; sets += cur.sets; allMet &&= cur.met;
    const same = ents.slice(1).filter((e) => e.variant === cur.variant);
    if (!same.length) continue;
    const delta = cur.total - same[0].total, name = rows[0].name;
    if (delta < worst) {
      const stall = Math.min(2, stallsOf(ents)) as 0 | 1 | 2, change = applyLafayProgress(rows)?.change;
      worst = delta;
      out.under = { sport: "WORKOUT", exercise: name, totalReps: cur.total, deltaReps: delta, stall, blocked: change === "evolve" || change === "restart", sessionLabel: label(input.workoutKind) };
    }
    const gain = cur.total - Math.max(...same.map((e) => e.total));
    if (gain > bestGain) { bestGain = gain; out.record = { sport: "WORKOUT", exercise: name, recordReps: cur.total, recordGain: gain }; }
  }
  if (count && allMet) out.met = { sport: "WORKOUT", sets, exercises: count };
  return out;
}
/** Faits de FC d'une séance de muscu ; rien (objet vide) sans ceinture, pour que le commentaire reste identique à avant. */
function hrFacts({ hr }: SessionInput): Pick<VerdictFacts, "hrAvg" | "hrMax" | "hrRestDrop"> {
  if (!hr || !(hr.avg > 0) || !(hr.max > 0)) return {};
  return { hrAvg: hr.avg, hrMax: hr.max, ...(hr.restDrop != null ? { hrRestDrop: hr.restDrop } : {}) };
}
const label = (k: SessionInput["workoutKind"]) => (k === "HAUT" ? "Haut du corps" : k === "BAS" ? "Bas du corps" : null);

function fatigueFacts(input: SessionInput, sport: "RUN" | "RIDE"): VerdictFacts | null {
  const dec = input.decouplingPct ?? (input.samples ? computeDecoupling(input.samples) : null);
  if (dec != null && dec > DECOUPLING_MAX_PCT) return { sport, decouplingPct: Math.round(dec * 10) / 10 };
  if (sport === "RUN" && input.avgHr && input.movingTimeS && input.distanceM) {
    const pace = input.movingTimeS / (input.distanceM / 1000);
    const near = (input.recentRuns ?? []).filter((r) => r.avgHr > 0 && Math.abs(r.paceSKm - pace) <= PACE_TOLERANCE_S).slice(0, RECENT_EF_COUNT);
    const med = near.length >= MIN_EF_SAMPLES ? median(near.map((r) => r.avgHr)) : null;
    if (med != null && input.avgHr - med >= HR_DRIFT_BPM) return { sport, hrDriftBpm: Math.round(input.avgHr - med) };
  }
  if (input.feeling === "TIRED" || input.feeling === "HARD") return { sport, feeling: input.feeling };
  return null;
}

function validatedRun(input: SessionInput, sport: "RUN" | "RIDE"): VerdictFacts | null {
  const plan = input.plan;
  if (!plan || !input.movingTimeS) return null;
  const pace = input.distanceM ? input.movingTimeS / (input.distanceM / 1000) : null;
  const paceOk = plan.paceSKm && pace != null ? inRange(pace, plan.paceSKm) : null;
  const hrOk = plan.hr && input.avgHr ? inRange(input.avgHr, plan.hr) : null;
  if (paceOk === false || hrOk === false || (paceOk == null && hrOk == null)) return null;
  return { sport, planLabel: plan.label, paceRangeSKm: paceOk ? plan.paceSKm : undefined, hrInZone: hrOk === true };
}

/** Priorité : record > fatigue > underperformance > constrained > validated. Null : activité exclue ou rien de factuel à dire. */
export function computeVerdict(input: SessionInput): Verdict | null {
  if (!SPORTS.includes(input.type) || isCommute({ type: input.type, startedAt: new Date(0), distanceM: 0, movingTimeS: 0, title: input.title, source: input.source, dedupeKey: input.dedupeKey })) return null;
  const sport = input.type as Sport;

  if (sport === "WORKOUT") {
    const s = strengthVerdicts(input), hr = hrFacts(input);
    if (s.record) return { kind: "record", facts: { ...s.record, ...hr } };
    if (s.under) return { kind: "underperformance", facts: { ...s.under, ...hr } };
    if (s.met) return constrain(input, { ...s.met, ...hr });
    return null;
  }

  const rec = input.records?.length ? input.records.reduce((a, b) => (b.label === "10 km" && a.label !== "10 km" ? b : a)) : null;
  if (rec) return { kind: "record", facts: { sport, recordLabel: rec.label, recordTimeS: Math.round(rec.timeS) } };
  const tired = fatigueFacts(input, sport);
  if (tired) return { kind: "fatigue", facts: tired };
  const ok = validatedRun(input, sport);
  return ok ? constrain(input, ok) : null;
}

/** Séance validée commencée à 21 h ou après, ou 2e séance du jour : « constrained ». */
function constrain(input: SessionInput, facts: VerdictFacts): Verdict {
  if (input.secondOfDay) return { kind: "constrained", facts: { ...facts, reason: "second" } };
  if (input.startHour >= LATE_START_HOUR) return { kind: "constrained", facts: { ...facts, reason: "late" } };
  return { kind: "validated", facts };
}
