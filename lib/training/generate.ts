/**
 * Construit un programme complet (phases, semaines, séances) à partir du catalogue. Fonction pure : l'écriture
 * en base est faite par lib/data/training.ts. Mode FLEXIBLE : `date` n'est qu'une suggestion, l'ordre fait foi.
 */
import type { PhaseType, SessionKind } from "@prisma/client";
import type { RunGeneratorInput, RunWorkoutStructure } from "@/types/training";
import { shiftDay } from "@/lib/dates";
import { RUN_BASE_VMA, SUGGESTED_OFFSETS, blockOf, isRecoveryWeek, weekSessions } from "./catalog/run-base-vma";
import { estimateRun } from "./resolve";

export type GeneratedSession = {
  orderInWeek: number; kind: SessionKind; title: string; description?: string; isKeySession: boolean;
  structure: RunWorkoutStructure; plannedDurationS: number; plannedDistanceM: number; date: string; // AAAA-MM-JJ suggéré
};
export type GeneratedWeek = { number: number; phaseOrder: number; startDate: string; isRecovery: boolean; targetDistanceM: number; note?: string; sessions: GeneratedSession[] };
export type GeneratedProgram = {
  program: {
    name: string; templateKey: string; templateVersion: number; schedulingMode: "FLEXIBLE"; startDate: string; endDate: string;
    totalWeeks: number; sessionsPerWeek: number; generatorInput: RunGeneratorInput;
  };
  phases: { order: number; type: PhaseType; name: string; focus: string }[];
  weeks: GeneratedWeek[];
};

/** Lundi de départ : la semaine en cours jusqu'au jeudi, sinon la suivante (pour ne pas démarrer sur une semaine déjà entamée). */
export function startMonday(todayKey: string) {
  const [y, m, d] = todayKey.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // 0 = lundi
  return shiftDay(todayKey, dow <= 3 ? -dow : 7 - dow);
}

export function generateRunBaseVma(input: { sessionsPerWeek: 2 | 3; vmaKmh: number; startDate: string; currentWeeklyDistanceM?: number; recentRace?: RunGeneratorInput["recentRace"] }): GeneratedProgram {
  const T = RUN_BASE_VMA, n = input.sessionsPerWeek;
  const weeks: GeneratedWeek[] = Array.from({ length: T.totalWeeks }, (_, i) => {
    const number = i + 1, startDate = shiftDay(input.startDate, i * 7), recovery = isRecoveryWeek(number);
    const sessions = weekSessions(number, n).map((s, j): GeneratedSession => {
      const est = estimateRun(s.structure, input.vmaKmh);
      return {
        orderInWeek: j + 1, kind: s.kind, title: s.title, description: s.description, isKeySession: s.isKeySession, structure: s.structure,
        plannedDurationS: est.durationS, plannedDistanceM: est.distanceM, date: shiftDay(startDate, SUGGESTED_OFFSETS[n][j]),
      };
    });
    return {
      number, phaseOrder: blockOf(number), startDate, isRecovery: recovery, sessions,
      targetDistanceM: sessions.reduce((t, s) => t + s.plannedDistanceM, 0),
      note: recovery ? "Semaine allégée : on récupère pour mieux progresser." : number === 1 ? "On commence par mesurer ta VMA." : undefined,
    };
  });
  return {
    program: {
      name: `${T.name} — ${T.totalWeeks} semaines`, templateKey: T.key, templateVersion: T.version, schedulingMode: "FLEXIBLE",
      startDate: input.startDate, endDate: shiftDay(input.startDate, T.totalWeeks * 7 - 1), totalWeeks: T.totalWeeks, sessionsPerWeek: n,
      generatorInput: {
        kind: "RUN", vmaKmh: input.vmaKmh, currentWeeklyDistanceM: Math.round(input.currentWeeklyDistanceM ?? 0), sessionsPerWeek: n, availableDays: [],
        ...(input.recentRace && { recentRace: input.recentRace }),
      },
    },
    phases: T.phases.map((p, i) => ({ order: i + 1, ...p })),
    weeks,
  };
}
