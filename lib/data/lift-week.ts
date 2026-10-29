/**
 * Muscu de la semaine pour la carte du jour de l'accueil : séances faites (total de répétitions et écart avec la précédente
 * du même type) et séances à venir placées en rotation (lib/coach/week-plan.ts), avec leurs exercices et cibles Lafay
 * (les mêmes que l'onglet Muscu de la page Programme et que « Démarrer »).
 */
import { dayKey, shiftDay, weekKeys } from "@/lib/dates";
import type { CoachPlan } from "@/lib/coach/today";
import { planLifts, type LiftHalfKind } from "@/lib/coach/week-plan";
import type { RunProgramView } from "@/lib/data/training";
import { getStrengthProgram } from "@/lib/data/strength-program";
import { KIND_TITLE } from "@/lib/workout/kind";
import { recentSessions } from "@/lib/workout/queries";
import type { Kind } from "@/lib/workout/types";

const TZ = "Europe/Paris";

export type LiftExercise = { code: string; name: string; target: string };
export type LiftSlide =
  | { state: "done"; id: string; day: string; kind: Kind; title: string; totalReps: number; delta: number | null; exercises: number }
  | { state: "planned"; id: string; day: string; kind: LiftHalfKind; title: string; items: LiftExercise[]; nextWeek: boolean };
export type LiftWeek = {
  /** Faites cette semaine, puis à venir (aujourd'hui compris si le coach propose la muscu), puis la suivante si rien d'autre ne tient. */
  slides: LiftSlide[];
  /** Cible hebdomadaire et séances faites cette semaine (pastilles « Muscu »). */
  target: number;
  done: number;
};

export async function getLiftWeek(userId: string, run: RunProgramView | null, coach: CoachPlan | null, target: number, now = new Date()): Promise<LiftWeek> {
  const [recent, program] = await Promise.all([recentSessions(userId, 30), getStrengthProgram(userId, now)]);
  const keys = weekKeys(now, TZ), today = dayKey(now, TZ), weekEnd = keys[6];
  const dayOf = (iso: string) => dayKey(new Date(iso), TZ);

  // Faites cette semaine (la plus ancienne d'abord), avec l'écart de répétitions avec la précédente du même type.
  const week = recent.filter((r) => keys.includes(dayOf(r.date))).reverse();
  const done: LiftSlide[] = week.map((r) => {
    const prev = recent.find((x) => x.kind === r.kind && x.date < r.date);
    return {
      state: "done", id: r.id, day: dayOf(r.date), kind: r.kind, title: r.kind === "LIBRE" ? r.title : KIND_TITLE[r.kind],
      totalReps: r.totalReps, delta: prev && r.kind !== "LIBRE" ? r.totalReps - prev.totalReps : null, exercises: r.exercises,
    };
  });

  // À venir : rotation haut / bas à partir de la dernière séance, placée selon les séances course prévues.
  const runs = (run?.status === "ACTIVE" ? run.weeks.flatMap((w) => w.sessions) : [])
    .filter((s) => s.status === "PLANNED")
    .map((s) => ({ day: s.date < shiftDay(today, 1) && s.isNext ? shiftDay(today, 1) : s.date, hard: s.isKeySession || s.kind === "LONG_RUN" }));
  const lastKind = recent.find((r) => r.kind !== "LIBRE")?.kind ?? null;
  const { placed, after } = planLifts({
    today, weekEnd, doneDays: done.map((d) => d.day), lastKind, lastDay: recent[0] ? dayOf(recent[0].date) : null,
    target, todayLift: coach?.kind === "lift", runs,
  });

  const rows = (kind: LiftHalfKind): LiftExercise[] =>
    (program.groups.find((g) => g.kind === kind)?.rows ?? []).map((r) => ({ code: r.code, name: r.name, target: r.target }));
  const planned: LiftSlide[] = placed.map((p) => ({ state: "planned", id: `lift-${p.day}`, day: p.day, kind: p.kind, title: KIND_TITLE[p.kind], items: rows(p.kind), nextWeek: false }));
  // Rien de plus cette semaine (cible atteinte ou plus de jour valable) : la suivante de la rotation, la semaine prochaine.
  if (!placed.some((p) => p.day > today)) {
    planned.push({ state: "planned", id: "lift-next-week", day: shiftDay(weekEnd, 1), kind: after, title: KIND_TITLE[after], items: rows(after), nextWeek: true });
  }
  return { slides: [...done, ...planned], target, done: done.length };
}
