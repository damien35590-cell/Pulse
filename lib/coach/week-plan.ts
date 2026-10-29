/**
 * Muscu de la semaine en rotation (doctrine du coach) : la prochaine séance est toujours l'autre moitié du corps que la dernière
 * (haut → bas → haut…), placée sur les jours restants de la semaine selon des règles simples. Rien n'est enregistré :
 * une séance ratée ne décale rien, elle attend le prochain jour valable. Fonctions pures (tests : tools/test-week-plan.ts).
 *
 * Règles de placement, dans l'ordre :
 * - au moins LIFT_EVERY_DAYS jours entre deux séances de muscu (faites ou placées) ;
 * - jamais le jour d'une séance clé ou d'une sortie longue ;
 * - jamais de bas du corps la veille d'une séance clé ou d'une sortie longue (impacts des squats sautés) ;
 * - de préférence un jour sans course ; sinon le haut du corps peut se doubler avec un footing (midi course, soir muscu).
 */
import { shiftDay } from "@/lib/dates";
import { nextKind } from "@/lib/workout/kind";
import type { Kind } from "@/lib/workout/types";
import { LIFT_EVERY_DAYS } from "./today";

export type LiftHalfKind = "HAUT" | "BAS";
/** Séance course à venir : jour prévu (AAAA-MM-JJ), séance clé ou sortie longue (« dure »). */
export type PlanRunDay = { day: string; hard: boolean };
export type PlacedLift = { day: string; kind: LiftHalfKind };

export type LiftPlanInput = {
  /** Aujourd'hui et dimanche de la semaine en cours (AAAA-MM-JJ). */
  today: string;
  weekEnd: string;
  /** Séances de muscu faites cette semaine (jours). */
  doneDays: string[];
  /** Type et jour de la dernière séance de muscu faite (toutes semaines confondues). */
  lastKind: Kind | null;
  lastDay: string | null;
  /** Cible de séances de muscu par semaine. */
  target: number;
  /** Le coach propose la muscu aujourd'hui : elle compte comme placée aujourd'hui. */
  todayLift: boolean;
  /** Séances course à venir, avec leur jour prévu. */
  runs: PlanRunDay[];
};

const gap = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** Séances de muscu à faire d'ici dimanche, dans l'ordre, et la suivante de la rotation (pour la semaine prochaine). */
export function planLifts(i: LiftPlanInput): { placed: PlacedLift[]; after: LiftHalfKind } {
  const placed: PlacedLift[] = [];
  let kind = nextKind(i.lastKind), last = i.lastDay;
  const runsOn = (d: string) => i.runs.filter((r) => r.day === d);
  if (i.todayLift) { placed.push({ day: i.today, kind }); last = i.today; kind = kind === "HAUT" ? "BAS" : "HAUT"; }

  let need = Math.max(0, i.target - i.doneDays.length - placed.length);
  const days: string[] = [];
  for (let d = shiftDay(i.today, 1); d <= i.weekEnd; d = shiftDay(d, 1)) days.push(d);

  while (need > 0) {
    const ok = (d: string, withRun: boolean) => {
      if (last && gap(last, d) < LIFT_EVERY_DAYS) return false;
      const here = runsOn(d);
      if (here.some((r) => r.hard)) return false;
      if (kind === "BAS" && runsOn(shiftDay(d, 1)).some((r) => r.hard)) return false;
      if (here.length && (!withRun || kind !== "HAUT")) return false;
      return true;
    };
    const day = days.find((d) => ok(d, false)) ?? days.find((d) => ok(d, true));
    if (!day) break;
    placed.push({ day, kind });
    last = day; kind = kind === "HAUT" ? "BAS" : "HAUT"; need--;
  }
  return { placed, after: kind };
}
