/**
 * Muscles travaillés, pour la carte du corps (components/body/body-map.tsx) : noms français, muscles d'un exercice d'après son nom,
 * carte d'une séance, volume par muscle sur une période, récupération. Fonctions pures, utilisables côté client
 * (tests : tools/test-body.ts).
 */
import { musclesOf, type Group } from "../muscles";
import { catalogFor, resolveName } from "./catalog";
import type { MuscleId, Muscles } from "./catalog-data";

export type { MuscleId, Muscles };
/** Niveau par muscle, de 0 à 1 ; un muscle absent vaut 0. */
export type MuscleLevels = Partial<Record<MuscleId, number>>;
export type MuscleLoad = { tonnage: number; sets: number };

export const MUSCLE_IDS: readonly MuscleId[] = [
  "chest", "front_delts", "side_delts", "rear_delts", "biceps", "triceps", "forearms", "abs", "obliques", "traps",
  "lats", "upper_back", "lower_back", "glutes", "quads", "hamstrings", "adductors", "calves", "neck",
];

export const MUSCLE_NAME: Record<MuscleId, string> = {
  chest: "Pectoraux", front_delts: "Avant des épaules", side_delts: "Côté des épaules", rear_delts: "Arrière des épaules",
  biceps: "Biceps", triceps: "Triceps", forearms: "Avant-bras", abs: "Abdominaux", obliques: "Obliques", traps: "Trapèzes",
  lats: "Grands dorsaux", upper_back: "Haut du dos", lower_back: "Lombaires", glutes: "Fessiers", quads: "Quadriceps",
  hamstrings: "Ischio-jambiers", adductors: "Adducteurs", calves: "Mollets", neck: "Cou",
};

/** « Pectoraux, triceps et avant des épaules » */
export function muscleList(ids: readonly MuscleId[]): string {
  const names = ids.map((id, i) => (i === 0 ? MUSCLE_NAME[id] : MUSCLE_NAME[id].toLowerCase()));
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} et ${names.at(-1)}` : names[0] ?? "";
}

/** Vue où le muscle se voit le mieux ; « both » : visible des deux côtés, il ne départage pas les vues. */
const SIDE: Record<MuscleId, "front" | "back" | "both"> = {
  chest: "front", front_delts: "front", biceps: "front", abs: "front", obliques: "front", quads: "front",
  rear_delts: "back", triceps: "back", traps: "back", lats: "back", upper_back: "back", lower_back: "back", glutes: "back", hamstrings: "back", calves: "back",
  side_delts: "both", forearms: "both", adductors: "both", neck: "both",
};

/**
 * Vue à montrer : celle du muscle moteur (`lead`, le premier principal d'un exercice) quand il ne se voit que d'un côté ;
 * sinon celle qui montre le plus de muscles sollicités (somme des niveaux), la face en cas d'égalité.
 */
export function preferredView(levels: MuscleLevels, lead?: MuscleId): "front" | "back" {
  if (lead && SIDE[lead] !== "both") return SIDE[lead];
  let front = 0, back = 0;
  for (const [id, v] of Object.entries(levels) as [MuscleId, number][]) {
    if (SIDE[id] === "front") front += v;
    else if (SIDE[id] === "back") back += v;
  }
  return back > front ? "back" : "front";
}

// Noms libres hors catalogue : le dictionnaire de lib/muscles.ts (groupes larges) traduit en muscles de la carte.
const GROUP_MUSCLES: Record<Group, MuscleId[]> = {
  pectoraux: ["chest"], dorsaux: ["lats", "upper_back"], "épaules": ["front_delts", "side_delts"], biceps: ["biceps"], triceps: ["triceps"],
  abdominaux: ["abs"], quadriceps: ["quads"], "ischio-jambiers": ["hamstrings"], mollets: ["calves"],
};
function fromGroups(name: string): Muscles | null {
  const primary = new Set<MuscleId>(), secondary = new Set<MuscleId>();
  for (const [g, w] of musclesOf(name)) for (const id of GROUP_MUSCLES[g]) (w >= 0.8 ? primary : secondary).add(id);
  primary.forEach((id) => secondary.delete(id));
  if (!primary.size && !secondary.size) return null;
  return primary.size ? { primary: [...primary], secondary: [...secondary] } : { primary: [...secondary], secondary: [] };
}

/** Muscles d'un exercice de séance (code Lafay + variante, ou nom) : ceux du catalogue, sinon devinés d'après le nom. */
export const musclesOfCode = (code: string, variant: string | null): Muscles | null => catalogFor(code, variant)?.muscles ?? fromGroups(code);

/** Muscles d'un exercice d'après son nom enregistré (« B2 - dips », « Rowing un bras (haltère) », « Squat »). */
export function musclesOfName(name: string): Muscles | null {
  const { code, variant } = resolveName(name);
  return musclesOfCode(code, variant);
}

/** Carte d'une séance : 1 pour chaque exercice où le muscle est principal, 0,5 où il est secondaire, additionnés puis plafonnés à 1. */
export function sessionLevels(list: readonly (Muscles | null | undefined)[]): MuscleLevels {
  const out: MuscleLevels = {};
  const add = (id: MuscleId, v: number) => { out[id] = Math.min(1, (out[id] ?? 0) + v); };
  for (const m of list) {
    if (!m) continue;
    m.primary.forEach((id) => add(id, 1));
    m.secondary.forEach((id) => add(id, 0.5));
  }
  return out;
}

type Ex = { name: string; sets: number; reps: number; loadKg: number | null };
/**
 * Volume par muscle : séries et tonnage, comptés en entier pour un muscle principal, à moitié pour un secondaire.
 * Sans charge (poids du corps), 60 % du poids du corps (70 kg par défaut), comme lib/muscles.ts.
 */
export function muscleVolume(exercises: readonly Ex[], bodyKg = 70): Record<MuscleId, MuscleLoad> {
  const out = Object.fromEntries(MUSCLE_IDS.map((id) => [id, { tonnage: 0, sets: 0 }])) as Record<MuscleId, MuscleLoad>;
  for (const e of exercises) {
    const m = musclesOfName(e.name);
    if (!m) continue;
    const load = e.loadKg ?? bodyKg * 0.6;
    for (const [ids, w] of [[m.primary, 1], [m.secondary, 0.5]] as const) {
      for (const id of ids) { out[id].sets += e.sets * w; out[id].tonnage += e.sets * e.reps * load * w; }
    }
  }
  return out;
}

/**
 * Heures pour récupérer d'une séance où le muscle était principal : 72 h pour les gros muscles, 48 h pour les moyens,
 * 36 h pour ceux qui récupèrent vite (abdos, mollets, avant-bras, cou). Ordres de grandeur, pas une mesure.
 */
export const RECOVERY_H: Record<MuscleId, number> = {
  chest: 72, lats: 72, upper_back: 72, lower_back: 72, glutes: 72, quads: 72, hamstrings: 72,
  front_delts: 48, side_delts: 48, rear_delts: 48, traps: 48, biceps: 48, triceps: 48, adductors: 48,
  abs: 36, obliques: 36, calves: 36, forearms: 36, neck: 36,
};

/**
 * Récupération de chaque muscle, de 0 (sollicité à l'instant) à 1 (récupéré), d'après les séances récentes : la charge d'une séance
 * (sessionLevels : 1 principal, 0,5 secondaire) s'efface linéairement sur RECOVERY_H, les séances s'additionnent.
 * Les muscles récupérés sont absents.
 */
export function recoveryLevels(sessions: readonly { at: Date; muscles: readonly (Muscles | null)[] }[], now = new Date()): MuscleLevels {
  const fatigue: MuscleLevels = {};
  for (const s of sessions) {
    const h = (+now - +s.at) / 36e5;
    if (h < 0) continue;
    for (const [id, load] of Object.entries(sessionLevels(s.muscles)) as [MuscleId, number][]) {
      const left = load * (1 - h / RECOVERY_H[id]);
      if (left > 0) fatigue[id] = (fatigue[id] ?? 0) + left;
    }
  }
  return Object.fromEntries((Object.entries(fatigue) as [MuscleId, number][]).map(([id, f]) => [id, Math.round((1 - Math.min(1, f)) * 100) / 100]));
}

/** Palier de récupération affiché (tokens muscle-tired → muscle-fresh) ; null : récupéré. */
export type RecoveryStep = "tired" | "worked" | "recovering" | "fresh";
export function recoveryStep(r: number | undefined): RecoveryStep | null {
  if (r == null || r >= 1) return null;
  return r < 0.25 ? "tired" : r < 0.5 ? "worked" : r < 0.75 ? "recovering" : "fresh";
}

/** Une phrase pour la carte de récupération : les muscles encore à ménager (récupérés à moins de moitié), les plus fatigués d'abord. */
export function recoveryLine(levels: MuscleLevels): string {
  const tired = (Object.entries(levels) as [MuscleId, number][]).filter(([, r]) => r < 0.5).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  if (!tired.length) return Object.keys(levels).length ? "Presque tout est récupéré : la voie est libre." : "Tous tes muscles sont récupérés.";
  return `Encore fatigués : ${muscleList(tired.slice(0, 3)).toLowerCase()}${tired.length > 3 ? "…" : "."}`;
}
