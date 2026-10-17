/**
 * Programme running « Reprise & VMA » — mode FLEXIBLE : une file de séances, pas de jours imposés.
 * 12 semaines = 3 blocs de 4 ; la 4e semaine de chaque bloc est allégée (volume × 0,7, aucune séance dure).
 * Toutes les intensités sont RELATIVES (% VMA) : une nouvelle VMA recalcule toutes les allures.
 */
import type { PhaseType, SessionKind } from "@prisma/client";
import type { Intensity, RunStep, RunWorkoutStructure, StepDuration, StepRole } from "@/types/training";

export const RUN_BASE_VMA = {
  key: "run.base-vma",
  version: 1,
  name: "Reprise & VMA",
  totalWeeks: 12,
  blockWeeks: 4,
  recoveryWeekFactor: 0.7,
  sessionsPerWeek: [2, 3] as const,
  phases: [
    { type: "BASE", name: "Base", focus: "Retrouver le rythme et mesurer ta VMA" },
    { type: "BUILD", name: "Développement", focus: "VMA courte et seuil, on monte en régime" },
    { type: "BUILD", name: "Consolidation", focus: "Des séances plus longues pour ancrer les progrès" },
  ] as { type: PhaseType; name: string; focus: string }[],
} as const;

export type SessionSpec = {
  kind: SessionKind;
  title: string;
  description?: string;
  isKeySession: boolean;
  structure: RunWorkoutStructure;
};

// ───────── Intensités (% VMA) ─────────
const EF = { ref: "VMA", pctMin: 65, pctMax: 75 } as const;     // endurance fondamentale
const RAC = { ref: "VMA", pctMin: 60, pctMax: 70 } as const;    // retour au calme
const TROT = { ref: "VMA", pctMin: 50, pctMax: 60 } as const;   // récupération trottinée
const SEUIL = { ref: "VMA", pctMin: 85, pctMax: 88 } as const;
const VMA_30 = { ref: "VMA", pctMin: 100, pctMax: 105 } as const;
const VMA_400 = { ref: "VMA", pctMin: 95, pctMax: 100 } as const;

const min = (m: number) => ({ type: "time" as const, s: Math.round(m * 60) });
const step = (role: StepRole, duration: StepDuration, target?: Intensity, extra: { label?: string; cue?: string } = {}): RunStep =>
  ({ kind: "step", role, duration, ...(target && { target: { ...target } }), ...extra });
const warmup = (m = 20) => step("warmup", min(m), EF, { cue: "Footing tranquille, tu dois pouvoir parler" });
const cooldown = (m = 10) => step("cooldown", min(m), RAC);
const structure = (...steps: RunStep[]): RunWorkoutStructure => ({ version: 1, steps });

// ───────── Séances ─────────
const vmaTest = (): SessionSpec => ({
  kind: "VMA_TEST", isKeySession: true, title: "Test VMA (demi-Cooper)",
  description: "6 minutes à fond, sur piste ou sur du plat. Note la distance parcourue : elle donne ta VMA (distance en m ÷ 100).",
  structure: structure(
    warmup(15),
    step("active", min(6), { ref: "VMA", pctMin: 100, pctMax: 100 }, { label: "à fond", cue: "Le plus loin possible en 6 minutes, allure régulière" }),
    cooldown(10),
  ),
});

const shortIntervals = (reps: number): SessionSpec => ({
  kind: "INTERVALS_SHORT", isKeySession: true, title: `VMA courte · ${reps} × 30/30`,
  description: "30 secondes vite, 30 secondes en trottinant. Reste régulier du premier au dernier.",
  structure: structure(warmup(), { kind: "repeat", times: reps, steps: [step("active", { type: "time", s: 30 }, VMA_30), step("recovery", { type: "time", s: 30 }, TROT)] }, cooldown()),
});

const fourHundreds = (reps: number): SessionSpec => ({
  kind: "INTERVALS_SHORT", isKeySession: true, title: `VMA courte · ${reps} × 400 m`,
  description: "Des 400 m réguliers, récupération en trottinant. Le dernier doit ressembler au premier.",
  structure: structure(warmup(), { kind: "repeat", times: reps, steps: [step("active", { type: "distance", m: 400 }, VMA_400), step("recovery", { type: "time", s: 75 }, TROT)] }, cooldown()),
});

const threshold = (reps: number, workMin: number, restMin: number): SessionSpec => ({
  kind: "THRESHOLD", isKeySession: true, title: `Seuil · ${reps} × ${workMin}′`,
  description: "Allure « confortablement difficile » : tu peux dire quelques mots, pas tenir une conversation.",
  structure: structure(warmup(), { kind: "repeat", times: reps, steps: [step("active", min(workMin), SEUIL), step("recovery", min(restMin), TROT)] }, cooldown()),
});

const easy = (m: number, recovery = false): SessionSpec => ({
  kind: "EASY", isKeySession: false, title: recovery ? `Footing souple · ${m}′` : `Footing en endurance · ${m}′`,
  description: recovery ? "Semaine allégée : on assimile le travail des semaines précédentes." : "Allure facile, en aisance respiratoire. C'est elle qui construit ton endurance.",
  structure: structure(step("active", min(m), EF)),
});

const longRun = (m: number, recovery = false): SessionSpec => ({
  kind: "LONG_RUN", isKeySession: false, title: `Sortie longue · ${m}′`,
  description: recovery ? "Version raccourcie : profite, sans regarder la montre." : "Allure facile du début à la fin. On allonge le temps, pas l'allure.",
  structure: structure(step("active", min(m), EF)),
});

/** Séance qualité de chaque semaine « normale » : VMA courte et seuil en alternance, de plus en plus difficiles. */
const QUALITY: Record<number, () => SessionSpec> = {
  1: vmaTest,
  2: () => shortIntervals(8),
  3: () => threshold(3, 6, 2),
  5: () => shortIntervals(10),
  6: () => threshold(3, 8, 2),
  7: () => fourHundreds(8),
  9: () => threshold(2, 12, 3),
  10: () => fourHundreds(10),
  11: () => threshold(2, 15, 3),
};
/** Footing (35 → 45′) et sortie longue (45 → 65′) par bloc, semaines 1 à 3. */
const EASY_MIN = [35, 40, 45];
const LONG_MIN = [[45, 50, 55], [50, 55, 60], [55, 60, 65]];

const round5 = (m: number) => Math.round(m / 5) * 5;
export const blockOf = (week: number) => Math.ceil(week / RUN_BASE_VMA.blockWeeks);
export const weekInBlock = (week: number) => ((week - 1) % RUN_BASE_VMA.blockWeeks) + 1;
export const isRecoveryWeek = (week: number) => weekInBlock(week) === RUN_BASE_VMA.blockWeeks;

/**
 * Séances d'une semaine, dans l'ordre : 3 séances = QUALITÉ, EASY, LONG_RUN ; 2 séances = QUALITÉ, LONG_RUN.
 * Semaine allégée : la qualité devient un footing, et tout le volume de la semaine 3 du bloc est multiplié par 0,7.
 */
export function weekSessions(week: number, sessionsPerWeek: 2 | 3): SessionSpec[] {
  const b = blockOf(week) - 1, w = weekInBlock(week);
  if (isRecoveryWeek(week)) {
    const f = RUN_BASE_VMA.recoveryWeekFactor, e = round5(EASY_MIN[b] * f), l = round5(LONG_MIN[b][2] * f);
    return sessionsPerWeek === 3 ? [easy(e, true), easy(e, true), longRun(l, true)] : [easy(e, true), longRun(l, true)];
  }
  const q = QUALITY[week](), l = longRun(LONG_MIN[b][w - 1]);
  return sessionsPerWeek === 3 ? [q, easy(EASY_MIN[b]), l] : [q, l];
}

/** Jours suggérés (décalage depuis le lundi) : rien n'est imposé, ce ne sont que des repères. */
export const SUGGESTED_OFFSETS: Record<2 | 3, number[]> = { 2: [2, 6], 3: [1, 3, 6] };
