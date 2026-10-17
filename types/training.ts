/**
 * Programmes v2 — types partagés (sans dépendance, comme lib/exercises.ts).
 *  A. Contenu des colonnes JSON (PlannedSession.structure, Program.generatorInput, WorkoutExercise.setsDetail)
 *  B. Catalogue dans le code (lib/training/catalog) : modèles de plans running, programmes muscu, exercices
 *  C. Vues calculées renvoyées à l'UI, dont la Home
 */
import type {
  Equipment,
  ExperienceLevel,
  Feasibility,
  GoalType,
  LoadType,
  Mechanic,
  MuscleGroup,
  PhaseType,
  SessionKind,
  SessionStatus,
  SetType,
} from "@prisma/client";

export type ProgramSport = "RUN" | "WORKOUT";

// ═════════ A. Colonnes JSON ═════════

/** Intensité RELATIVE : l'allure est calculée à l'affichage avec ta VMA du moment. Nouvelle VMA → tout le plan suit. */
export type Intensity =
  | { ref: "VMA"; pctMin: number; pctMax: number }          // % de VMA
  | { ref: "RACE_PACE"; deltaSPerKm?: number }               // allure de l'objectif, ± un écart
  | { ref: "HR_ZONE"; zone: 1 | 2 | 3 | 4 | 5 }              // zone cardio
  | { ref: "PACE"; sPerKmMin: number; sPerKmMax: number }    // allure absolue (rare)
  | { ref: "RPE"; value: number };                           // ressenti 1–10

export type StepDuration =
  | { type: "time"; s: number }
  | { type: "distance"; m: number }
  | { type: "lap" }; // jusqu'à l'appui sur le bouton tour

export type StepRole = "warmup" | "active" | "recovery" | "cooldown" | "rest";

export type RunStep =
  | { kind: "step"; role: StepRole; duration: StepDuration; target?: Intensity; label?: string; cue?: string }
  | { kind: "repeat"; times: number; steps: RunStep[] };

/** PlannedSession.structure (running). Pensé pour être traduit en séance structurée Intervals.icu → Garmin. */
export type RunWorkoutStructure = { version: 1; steps: RunStep[] };

export type RunGeneratorInput = {
  kind: "RUN";
  vmaKmh: number;
  hrMax?: number;
  hrRest?: number;
  recentRace?: { distanceM: number; timeS: number; date: string };
  currentWeeklyDistanceM: number; // moyenne des 4 dernières semaines
  longestRecentRunM?: number;
  sessionsPerWeek: number;
  availableDays: number[]; // jours ISO 1–7
  crossTrainingDays?: number[];
};

export type StrengthGeneratorInput = {
  kind: "WORKOUT";
  goal: "HYPERTROPHY" | "FORCE" | "MAINTENANCE";
  daysPerWeek: number;
  sessionMaxMin?: number;
  equipment: Equipment[];
  bodyweightKg?: number;
  startingLoads: Record<string, number>; // slug d'exercice → charge de travail (kg)
};

/** Program.generatorInput */
export type GeneratorInput = RunGeneratorInput | StrengthGeneratorInput;

/** WorkoutExercise.setsDetail : prolonge SetDetail (lib/exercises.ts) avec des champs facultatifs, compatible avec l'existant. */
export type SetDetailV2 = {
  reps: number;
  loadKg: number | null;
  done: boolean;
  rir?: number;       // reps en réserve ressenties
  isWarmup?: boolean;
  durationS?: number; // gainage, isométrie
};

// ═════════ B. Catalogue (dans le code) ═════════

/** Modèle de plan running : des règles appliquées à ton objectif, ta VMA et tes dispos — pas des séances figées. */
export interface RunPlanTemplate {
  key: string; // "run.race-time"
  version: number;
  name: string;
  goalTypes: GoalType[];
  weeksByDistance: Record<number, { min: number; max: number }>; // 21097 → 10–14 semaines
  phaseSplit: { type: PhaseType; share: number; name: string; focus: string }[];
  recoveryWeekEvery: number;  // 1 semaine d'assimilation toutes les N
  recoveryWeekFactor: number; // volume × 0,7
  maxWeeklyIncrease: number;  // +10 % max
  taperVolumeFactor: number;  // × 0,6
  weeklyPatterns: Record<number, SessionKind[]>; // nb de séances/sem → types de séances
  variants: RunSessionVariant[];
}

export interface RunSessionVariant {
  id: string; // "vma-courte-10x400"
  kind: SessionKind;
  phases: PhaseType[];
  levels: ExperienceLevel[];
  difficulty: 1 | 2 | 3 | 4 | 5;
  isKeySession?: boolean;
  title: string;
  description?: string;
  structure: RunWorkoutStructure;
}

/** Programme muscu : cycles, séances types, progression. */
export interface StrengthProgramTemplate {
  key: string; // "strength.hypertrophy-fb3"
  version: number;
  name: string;
  description: string;
  split: "FULL_BODY" | "HALF_BODY" | "UPPER_LOWER" | "PUSH_PULL_LEGS" | "BODYWEIGHT";
  levels: ExperienceLevel[];
  daysPerWeek: number;
  equipment: Equipment[];
  rotation: string[]; // ["A", "B"] → A B A puis B A B
  cycle: { type: PhaseType; weeks: number; name: string; focus: string; volumeFactor?: number; intensityFactor?: number }[];
  maintenance?: { volumeFactor: number; frequencyPerWeek?: number };
  workouts: StrengthWorkoutBlueprint[];
}

export interface StrengthWorkoutBlueprint {
  key: string;
  name: string;
  estimatedDurationMin?: number;
  slots: SlotBlueprint[];
}

export interface SlotBlueprint {
  exerciseSlug: string;
  sets: number;
  reps?: [number, number]; // fourchette ; [10, 10] = fixe
  durationS?: number;
  targetRir?: number;
  restS: number;
  tempo?: string;
  setType?: SetType;
  supersetGroup?: string;
  warmupSets?: number;
  progression: ProgressionConfig;
  notes?: string;
}

export type ProgressionConfig =
  | { rule: "DOUBLE_PROGRESSION"; loadIncrementKg: number }
  | { rule: "LINEAR_LOAD"; loadIncrementKg: number; deloadAfterStalls: number; deloadPct: number }
  | { rule: "REPS_THEN_VARIANT"; repIncrement: number }
  | { rule: "RIR_AUTOREGULATED"; loadStepKg: number }
  | { rule: "MAINTAIN" }
  | { rule: "NONE" };

/** Seed de la table Exercise. */
export interface ExerciseSeed {
  slug: string;
  name: string;
  aliases?: string[];
  equipment: Equipment;
  loadType: LoadType;
  mechanic?: Mechanic;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  difficulty?: number;
  harderVariantSlug?: string;
  instructions?: string;
}

// ═════════ C. Vues calculées ═════════

export interface ResolvedRunStep {
  role: StepRole;
  label?: string;
  duration: StepDuration;
  paceSPerKm?: { min: number; max: number }; // → « 4:10–4:20 /km »
  hrBpm?: { min: number; max: number };
  rpe?: number;
  repeat?: { current: number; total: number };
}

/** Ce que tu dois faire sur un exercice aujourd'hui (charges calculées). */
export interface StrengthPrescription {
  slotId: string;
  exerciseId: string;
  exerciseName: string;
  supersetGroup?: string;
  sets: { index: number; isWarmup: boolean; reps?: number | [number, number]; durationS?: number; loadKg?: number; targetRir?: number; restS?: number }[];
  lastPerformance?: string; // « 3×10 · 3×9 à 60 kg (il y a 4 j) »
  hint?: string;            // « Fais 3×12 pour passer à 62,5 kg »
}

export interface SessionPreview {
  id: string;
  programId: string;
  sport: ProgramSport;
  kind: SessionKind;
  date: string; // AAAA-MM-JJ
  title: string;
  summary: string; // « 20′ EF · 10 × 400 m (r 1′15) · 10′ RAC »
  isKeySession: boolean;
  status: SessionStatus;
  durationS?: number;
  distanceM?: number;
  workoutName?: string;
}

/** Carte « programme actif » de la Home (une par sport actif). */
export interface ActiveProgramCard {
  programId: string;
  sport: ProgramSport;
  name: string;
  goalLabel?: string;
  daysToGoal?: number;
  phase: { name: string; type: PhaseType; focus?: string };
  week: { current: number; total: number; isRecovery: boolean };
  progressPct: number;
  adherencePct: number;
  weekDots: { date: string; kind: SessionKind; status: SessionStatus; isKey: boolean }[];
  next: SessionPreview | null;
  run?: { targetTimeS?: number; predictedTimeS?: number; vmaKmh?: number; requiredVmaKmh?: number; feasibility: Feasibility };
  strength?: { highlights: { exercise: string; prescription: string; trend: "up" | "flat" | "down" }[] };
}

/** Réponse de GET /api/training/home : une seule requête pour toute la section. */
export interface HomeTrainingSnapshot {
  today: SessionPreview[];
  programs: ActiveProgramCard[]; // 0, 1 ou 2
  generatedAt: string;
}
