/**
 * Verdict « prochaine fois » d'un exercice Lafay, affiché en fin d'exercice dans le SetLogger.
 * Rejoue applyLafayProgress (lib/workout/lafay.ts, inchangée) sur la séance du jour + les séances passées embarquées dans le brouillon :
 * aucun appel réseau pendant la séance. Pure (tests : tools/test-workout.ts).
 */
import { applyLafayProgress } from "./lafay";
import type { PastRow } from "./types";

export type NextVerdict = { tone: "up" | "same" | "down" | "evolve"; text: string };

export function nextVerdict(e: { name: string; sets: number; reps: number; done: { reps: number }[]; past?: PastRow[] }): NextVerdict | null {
  if (!e.past || !e.done.length) return null;
  const now = new Date();
  const today = { activityId: "__now", startedAt: now, name: e.name, sets: e.sets, reps: e.reps, loadKg: null, setsDetail: e.done.map((d) => ({ reps: d.reps, loadKg: null, done: true })) };
  const past = e.past.map((r) => ({ ...r, startedAt: now, loadKg: null, setsDetail: r.setsDetail?.map((d) => ({ ...d, loadKg: null })) ?? null }));
  const t = applyLafayProgress([today, ...past], e.sets);
  if (!t) return null;
  const target = `${t.sets} × ${t.reps}`;
  switch (t.change) {
    case "progress": return { tone: t.reps > e.reps ? "up" : "same", text: t.reps > e.reps ? `Prochaine fois : ${target}` : `Prochaine fois : même cible, ${target}` };
    case "repeat": return { tone: "same", text: t.hint === "saute plus haut" ? "Prochaine fois : saute plus haut" : `Prochaine fois : même cible, ${target}` };
    case "restart": return { tone: "down", text: `Prochaine fois : on redescend à ${target}` };
    case "evolve": return { tone: "evolve", text: `Prochaine fois : passe à ${t.variant} à ${target}` };
  }
}
