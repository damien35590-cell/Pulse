/**
 * Export des données de muscu d'un utilisateur : JSON complet (restaurable par tools/restore-backup.ts) et CSV à plat.
 * Les séances sont des Activity (type WORKOUT ou ayant des WorkoutExercise) ; le reste est la structure muscu (modèles, programmes, suivi de progression).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** À incrémenter si la forme du fichier change ; le script de restauration refuse une version qu'il ne connaît pas. */
export const SCHEMA_VERSION = 1;

/**
 * Champs d'Activity trop lourds ou recalculables (traces GPS, rubans, météo) : exclus de la sauvegarde muscu. Tout le reste part, donc `warmup`
 * (échauffement de la séance) et `hrSeries` : un nouveau champ d'Activity est sauvegardé sans rien changer ici. Format additif : SCHEMA_VERSION reste 1,
 * une sauvegarde d'avant l'échauffement (sans `warmup`) se restaure telle quelle (lib/backup/revive.ts).
 */
const ACTIVITY_SKIP = new Set(["polyline", "trackPoints", "startLat", "startLng", "weather", "zoneRibbon", "zoneRibbonSource", "zoneRibbonRef", "zoneRibbonAt"]);
export const ACTIVITY_FIELDS = Object.values(Prisma.ActivityScalarFieldEnum).filter((f) => !ACTIVITY_SKIP.has(f));
const activitySelect = Object.fromEntries(ACTIVITY_FIELDS.map((f) => [f, true])) as Prisma.ActivitySelect;

/** Ordre de restauration (les parents avant les enfants) : clé du fichier → modèle Prisma. */
export const RESTORE_ORDER = [
  ["exercises", "Exercise"],
  ["trainingGoals", "TrainingGoal"],
  ["programs", "Program"],
  ["programPhases", "ProgramPhase"],
  ["programWeeks", "ProgramWeek"],
  ["programWorkouts", "ProgramWorkout"],
  ["programExerciseSlots", "ProgramExerciseSlot"],
  ["workoutTemplates", "WorkoutTemplate"],
  ["workoutTemplateExercises", "WorkoutTemplateExercise"],
  ["activities", "Activity"],
  ["workoutExercises", "WorkoutExercise"],
  ["plannedSessions", "PlannedSession"],
  ["athleteMetrics", "AthleteMetric"],
  // Tests de niveau Lafay : absents des sauvegardes d'avant (lus comme une liste vide à la restauration).
  ["lafayTests", "LafayTest"],
] as const;
export type BackupKey = (typeof RESTORE_ORDER)[number][0];

export type BackupFile = {
  schemaVersion: number;
  exportedAt: string;
  userId: string;
  /** `warmupDefaults` : réglage « Échauffement » (absent des sauvegardes d'avant ; null = jamais réglé). */
  profile: { homeEquipment: string[]; warmupDefaults?: unknown };
  counts: Record<BackupKey, number>;
  data: Record<BackupKey, Record<string, unknown>[]>;
};

type Row = Record<string, unknown>;
const rows = (r: unknown[]) => r as Row[];

export async function exportStrength(userId: string, now = new Date()): Promise<BackupFile> {
  const strengthActivity: Prisma.ActivityWhereInput = { userId, OR: [{ type: "WORKOUT" }, { exercises: { some: {} } }] };
  const programs = { userId, sport: "WORKOUT" as const };
  const [user, exercises, trainingGoals, progs, phases, weeks, workouts, slots, templates, templateExercises, activities, workoutExercises, plannedSessions, athleteMetrics, lafayTests] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { homeEquipment: true, warmupDefaults: true } }),
    prisma.exercise.findMany({ orderBy: { slug: "asc" } }),
    prisma.trainingGoal.findMany({ where: { userId, sport: "WORKOUT" }, orderBy: { createdAt: "asc" } }),
    prisma.program.findMany({ where: programs, orderBy: { createdAt: "asc" } }),
    prisma.programPhase.findMany({ where: { program: programs }, orderBy: [{ programId: "asc" }, { order: "asc" }] }),
    prisma.programWeek.findMany({ where: { program: programs }, orderBy: [{ programId: "asc" }, { number: "asc" }] }),
    prisma.programWorkout.findMany({ where: { program: programs }, orderBy: [{ programId: "asc" }, { order: "asc" }] }),
    prisma.programExerciseSlot.findMany({ where: { workout: { program: programs } }, orderBy: [{ workoutId: "asc" }, { order: "asc" }] }),
    prisma.workoutTemplate.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.workoutTemplateExercise.findMany({ where: { template: { userId } }, orderBy: [{ templateId: "asc" }, { order: "asc" }] }),
    prisma.activity.findMany({ where: strengthActivity, select: activitySelect, orderBy: { startedAt: "asc" } }),
    prisma.workoutExercise.findMany({ where: { activity: strengthActivity }, orderBy: [{ activityId: "asc" }, { position: "asc" }] }),
    prisma.plannedSession.findMany({ where: { userId, sport: "WORKOUT" }, orderBy: { date: "asc" } }),
    prisma.athleteMetric.findMany({ where: { userId, type: "BODYWEIGHT_KG" }, orderBy: { measuredAt: "asc" } }),
    prisma.lafayTest.findMany({ where: { userId }, orderBy: { takenAt: "asc" } }),
  ]);
  const data: BackupFile["data"] = {
    exercises: rows(exercises), trainingGoals: rows(trainingGoals), programs: rows(progs), programPhases: rows(phases), programWeeks: rows(weeks),
    programWorkouts: rows(workouts), programExerciseSlots: rows(slots), workoutTemplates: rows(templates), workoutTemplateExercises: rows(templateExercises),
    activities: rows(activities), workoutExercises: rows(workoutExercises), plannedSessions: rows(plannedSessions), athleteMetrics: rows(athleteMetrics),
    lafayTests: rows(lafayTests),
  };
  const counts = Object.fromEntries(RESTORE_ORDER.map(([k]) => [k, data[k].length])) as BackupFile["counts"];
  return { schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), userId, profile: { homeEquipment: user?.homeEquipment ?? [], warmupDefaults: user?.warmupDefaults ?? null }, counts, data };
}

// ───────── CSV ─────────
const CSV_HEADER = ["date", "seance", "exercice_code", "exercice", "serie", "reps", "charge_kg", "repos_s", "commentaire"];
const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Neutralise les formules si le CSV est ouvert dans un tableur (=, +, -, @ en tête de texte).
  const safe = typeof v === "string" && /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\r\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const parisDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
type SetRow = { reps?: number; loadKg?: number | null; done?: boolean; restTakenS?: number | null };

/** Une ligne par série réalisée : date, séance, exercice (code du catalogue + nom), n° de série, reps, charge, repos, commentaire. */
export function toCsv(b: BackupFile): string {
  const acts = new Map(b.data.activities.map((a) => [String(a.id), a]));
  const slugs = new Map(b.data.exercises.map((e) => [String(e.id), String(e.slug)]));
  const out: string[] = [CSV_HEADER.join(",")];
  const lines = b.data.workoutExercises
    .map((e) => ({ e, a: acts.get(String(e.activityId)) }))
    .filter((x): x is { e: Row; a: Row } => !!x.a)
    .sort((x, y) => +new Date(String(x.a.startedAt)) - +new Date(String(y.a.startedAt)) || Number(x.e.position) - Number(y.e.position));
  for (const { e, a } of lines) {
    const date = parisDay(new Date(String(a.startedAt)));
    const code = e.exerciseId ? slugs.get(String(e.exerciseId)) ?? "" : "";
    const detail = Array.isArray(e.setsDetail) ? (e.setsDetail as SetRow[]) : null;
    const sets: SetRow[] = detail ? detail.filter((s) => s.done) : Array.from({ length: Number(e.sets) }, () => ({ reps: Number(e.reps), loadKg: e.loadKg as number | null }));
    sets.forEach((s, i) => out.push([date, a.title, code, e.name, i + 1, s.reps, s.loadKg ?? e.loadKg, s.restTakenS ?? e.restS, i === 0 ? e.comment : ""].map(cell).join(",")));
  }
  return "﻿" + out.join("\r\n") + "\r\n"; // BOM : Excel lit l'UTF-8
}
