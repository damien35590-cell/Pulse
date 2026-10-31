/** Brouillon ↔ SetLogger ↔ API : conversions pures (tests : tools/test-workout.ts). */
import type { LiftExercise } from "@/components/workout/set-logger";
import type { DraftExercise } from "./types";
import { catalogFor } from "./catalog";
import type { HrSample } from "./hr";
import { warmupPayload, type WarmupLive } from "./warmup";

/** Un exercice du brouillon prêt pour le SetLogger : cibles, repos, et « précédent » série par série. Sans charge = poids du corps (la charge devient un lest). */
export function toLift(d: DraftExercise): LiftExercise {
  const bodyweight = d.loadKg == null;
  return {
    name: d.name, sets: d.sets, reps: d.reps, kg: d.loadKg ?? 0, step: bodyweight ? 1 : 2.5,
    restS: d.restSec, restAfterS: d.restAfterSec, bodyweight, timed: catalogFor(d.code, d.variant)?.mode === "time",
    prev: (d.last?.reps ?? []).map((reps) => ({ reps, kg: d.last?.loadKg ?? 0 })),
    ...(d.past?.length ? { past: d.past } : {}),
    done: [],
  };
}

/**
 * Un exercice fait → ligne de POST /api/activities : le prévu (sets, reps, charge, repos) et le réel série par série.
 * `completedAt` (ISO) et `restTakenS` : instant de validation et repos pris ensuite, d'où le serveur tire la FC de chaque série (lib/workout/hr.ts).
 */
export function toPayload(e: LiftExercise) {
  const load = (kg: number) => (e.bodyweight && !kg ? null : kg);
  return {
    name: e.name, sets: e.sets, reps: e.reps, loadKg: load(e.kg), restS: e.restS,
    setsDetail: e.done.map((d) => ({
      reps: d.reps, loadKg: load(d.kg), done: true,
      ...(e.timed ? { durationS: d.reps } : {}),
      ...(d.at ? { completedAt: new Date(d.at).toISOString() } : {}),
      ...(d.restS ? { restTakenS: d.restS } : {}),
      ...(d.hard ? { hard: true } : {}),
    })),
  };
}

/**
 * Corps de POST /api/activities pour une séance du SetLogger : seuls les exercices avec au moins une série validée.
 * L'échauffement part à part (`warmup`, absent s'il a été passé) : jamais parmi les exercices. La durée court depuis le début de la séance, échauffement compris.
 */
export function sessionBody(
  run: { clientId: string; title: string; kind: string; templateId: string | null; startedAt: number },
  exs: LiftExercise[],
  now: number,
  extra: { hrSeries?: HrSample[]; warmup?: WarmupLive | null } = {},
) {
  const warmup = warmupPayload(extra.warmup, run.startedAt, now);
  return {
    clientId: run.clientId, type: "WORKOUT", title: run.title, kind: run.kind, templateId: run.templateId, startedAt: new Date(run.startedAt).toISOString(),
    movingTimeS: Math.max(60, Math.round((now - run.startedAt) / 1000)), exercises: exs.filter((e) => e.done.length).map(toPayload), gearIds: [] as string[],
    ...(extra.hrSeries?.length ? { hrSeries: extra.hrSeries } : {}),
    ...(warmup ? { warmup } : {}),
  };
}

/** Titre par défaut d'une séance libre, comme l'ancien écran : « Musculation du matin ». */
export function freeTitle(at: Date) {
  const h = at.getHours();
  return `Musculation ${h < 12 ? "du matin" : h < 18 ? "de l’après-midi" : "du soir"}`;
}
