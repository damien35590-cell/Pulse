/**
 * Bilan d'une séance de muscu pour la fiche d'activité : par exercice, le réel série par série, l'écart avec la séance précédente
 * du même exercice (même variante), l'état de progression et la cible suivante. Rejoue les règles existantes sans les changer :
 * lafayView (lib/workout/lafay.ts) pour Lafay, loopState (lib/workout/loop.ts) pour les autres exercices.
 * Pure, sans base de données (tests : tools/test-session-review.ts) ; la lecture Prisma est dans lib/data/strength-review.ts.
 */
import { entriesOf, groupKey, type Det, type StrengthRow } from "../analytics/strength-rows";
import { catalogFor, isLafayCode, resolveName } from "./catalog";
import { lafayView } from "./lafay";
import { loopState } from "./loop";
import { exerciseShortName, isTimed } from "../art/set-bars";

/** Un exercice de la séance, tel que lu en base (WorkoutExercise). */
export type ReviewInput = { id: string; activityId: string; name: string; sets: number; reps: number; loadKg: number | null; restS: number | null; comment: string | null; setsDetail: unknown };

export type ReviewSet = { value: number; done: boolean; hard?: boolean; loadKg: number | null; hrPeak?: number | null; hrEndRest?: number | null };
export type ReviewStatus = { label: string; tone: "good" | "neutral" | "warn" };

export type ExerciseReview = {
  id: string;
  /** Code Lafay de la variante (« A3 »), sinon null. */
  code: string | null;
  /** Nom du catalogue (« Pompes »), sinon le nom saisi. */
  title: string;
  /** Ce qui distingue la variante (catalogue), sinon null. */
  subtitle: string | null;
  timed: boolean;
  /** « 6 × 10 · repos 30 s », « 3 × 10 s », « 4 × 8 à 20 kg · repos 90 s ». */
  targetText: string;
  /** Cible par série (reps ou secondes) : celle du jour, sinon le maximum fait. */
  target: number;
  /** Séries hors échauffement, faites ou non. */
  sets: ReviewSet[];
  /** Total des séries faites (reps, ou secondes si `timed`). */
  total: number;
  /** Écart de total avec la séance précédente du même exercice dans la même variante ; null sans historique. */
  delta: number | null;
  status: ReviewStatus | null;
  /** « Prochaine fois : 6 × 11 », « Variante suivante proposée : B3 à 6 × 8 »… (Lafay seulement). */
  next: string | null;
  /** Charge d'une série différente de la charge prévue : on la montre. */
  loads: string | null;
  comment: string | null;
};

export type SessionTotals = { exercises: number; sets: number; reps: number; seconds: number };

type RawSet = Det & { isWarmup?: boolean };
const fmtN = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

/** Séries hors échauffement ; sans détail série par série, le prévu est supposé fait (comme doneSets). */
function setsOf(e: ReviewInput): ReviewSet[] {
  if (Array.isArray(e.setsDetail) && e.setsDetail.length) {
    return (e.setsDetail as RawSet[]).filter((s) => s && !s.isWarmup && typeof s.reps === "number")
      .map((s) => ({ value: s.reps, done: s.done !== false && s.reps > 0, hard: s.hard, loadKg: s.loadKg ?? null, hrPeak: s.hrPeak, hrEndRest: s.hrEndRest }));
  }
  return e.sets > 0 && e.reps > 0 ? Array.from({ length: e.sets }, () => ({ value: e.reps, done: true, loadKg: e.loadKg })) : [];
}

export const toStrengthRow = (e: Pick<ReviewInput, "activityId" | "name" | "sets" | "reps" | "loadKg" | "setsDetail">, startedAt: Date): StrengthRow => ({
  activityId: e.activityId, startedAt, name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg,
  setsDetail: Array.isArray(e.setsDetail) ? (e.setsDetail as StrengthRow["setsDetail"]) : null,
});

/** « 6 × 10 », « 3 × 10 s ». */
const scheme = (sets: number, reps: number, timed: boolean) => `${sets} × ${reps}${timed ? " s" : ""}`;

/**
 * `exercises` : la séance, dans l'ordre. `history` : lignes des séances PRÉCÉDENTES, groupées par groupKey, de la plus récente à la plus ancienne.
 * Les lignes de la séance elle-même sont ajoutées en tête : l'état et la cible se lisent « au soir de cette séance ».
 */
export function reviewSession(exercises: ReviewInput[], startedAt: Date, history: Map<string, StrengthRow[]>): ExerciseReview[] {
  const current = new Map<string, StrengthRow[]>();
  for (const e of exercises) {
    const k = groupKey(e.name);
    if (!k) continue;
    current.set(k, [...(current.get(k) ?? []), toStrengthRow(e, startedAt)]);
  }

  return exercises.map((e) => {
    const { code, variant } = resolveName(e.name);
    const lafay = isLafayCode(code), cat = catalogFor(code, variant), timed = isTimed(e.name);
    const sets = setsOf(e), done = sets.filter((s) => s.done);
    const total = done.reduce((s, x) => s + x.value, 0);
    const target = e.reps > 0 ? e.reps : Math.max(0, ...done.map((s) => s.value));
    const k = groupKey(e.name), rows = k ? [...(current.get(k) ?? []), ...(history.get(k) ?? [])] : [];

    // Écart : la séance précédente de la même variante (une autre variante est un autre exercice).
    const ents = entriesOf(rows), cur = ents[0];
    const prev = cur ? ents.slice(1).find((x) => x.variant === cur.variant) : undefined;
    const delta = cur && prev ? cur.total - prev.total : null;

    let status: ReviewStatus | null = null, next: string | null = null;
    if (lafay && cur) {
      const { state, target: t } = lafayView(rows, e.sets);
      if (state === "stall1" || state === "stall2") status = { label: `Blocage ${state === "stall1" ? "1" : "2"}/2`, tone: "warn" };
      else if (state === "progress" || t?.change === "progress" || t?.change === "evolve") status = { label: "Progrès", tone: "good" };
      else status = { label: "Stable", tone: "neutral" };
      if (t) {
        const s = scheme(t.sets, t.reps, timed);
        next = t.change === "evolve" ? `Variante suivante proposée : ${t.variant} à ${s}`
          : t.change === "restart" ? `Prochaine fois : on repart à ${s}`
          : t.hint === "saute plus haut" ? "Prochaine fois : saute plus haut"
          : t.hint === "plafond atteint" ? `Plafond atteint : ${s}`
          : t.change === "progress" && t.reps > e.reps ? `Prochaine fois : ${s}`
          : `Prochaine fois : même cible, ${s}`;
      }
    } else if (cur && ents.length > 1) {
      const state = loopState([...ents].reverse().map((x) => ({ reps: x.total, variant: x.variant })));
      if (state === "stall1" || state === "stall2") status = { label: `Blocage ${state === "stall1" ? "1" : "2"}/2`, tone: "warn" };
      else if (state === "progress") status = { label: "Progrès", tone: "good" };
    }

    const odd = done.filter((s) => s.loadKg != null && s.loadKg !== e.loadKg);
    const loads = odd.length ? done.map((s) => (s.loadKg != null ? fmtN(s.loadKg) : "–")).join(" · ") + " kg" : null;
    const targetText = [
      `${scheme(e.sets, target, timed)}${e.loadKg != null ? ` à ${fmtN(e.loadKg)} kg` : ""}`,
      e.restS != null && `repos ${e.restS} s`,
    ].filter(Boolean).join(" · ");

    return {
      id: e.id, code: lafay ? (variant ?? code) : null,
      title: cat ? cat.name : lafay ? exerciseShortName(e.name) : e.name,
      subtitle: cat?.subtitle ?? null,
      timed, targetText, target, sets, total, delta, status, next, loads, comment: e.comment,
    };
  });
}

/** Chiffres de tête : exercices, séries faites, répétitions (exercices au chrono à part, en secondes). */
export function sessionTotals(reviews: ExerciseReview[]): SessionTotals {
  let sets = 0, reps = 0, seconds = 0;
  for (const r of reviews) {
    const done = r.sets.filter((s) => s.done);
    sets += done.length;
    if (r.timed) seconds += r.total; else reps += r.total;
  }
  return { exercises: reviews.length, sets, reps, seconds };
}
