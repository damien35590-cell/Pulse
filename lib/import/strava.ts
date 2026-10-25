import { overlapRatio, OVERLAP_RATIO } from "@/lib/pipeline/post-import";
import type { ActivityKind, ParsedActivity } from "./types";

/**
 * Archive officielle Strava (activities.csv) : lecture du CSV, correspondance des types, détection des doublons.
 * Pur (aucun accès disque ni base) pour rester testable ; la lecture des fichiers et l'écriture sont dans tools/import-strava.ts.
 */

// ───────── CSV ─────────

/** CSV RFC 4180 : guillemets, guillemets doublés et retours à la ligne dans les champs (les descriptions Strava en contiennent). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`]/g, "'").toLowerCase().replace(/\s+/g, " ").trim();

/** Nombre à la française ou à l'anglaise ("6,71" ou "6.71") ; undefined si vide ou illisible. */
export function parseNumber(s: string | undefined): number | undefined {
  const t = (s ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return undefined;
  const v = Number(t);
  return Number.isFinite(v) ? v : undefined;
}

const MONTHS: Record<string, number> = {
  janv: 0, jan: 0, janvier: 0, january: 0, fevr: 1, feb: 1, fevrier: 1, february: 1, mars: 2, mar: 2, march: 2, avr: 3, apr: 3, avril: 3, april: 3,
  mai: 4, may: 4, juin: 5, jun: 5, june: 5, juil: 6, jul: 6, juillet: 6, july: 6, aout: 7, aug: 7, august: 7, sept: 8, sep: 8, septembre: 8, september: 8,
  oct: 9, octobre: 9, october: 9, nov: 10, novembre: 10, november: 10, dec: 11, decembre: 11, december: 11,
};

/** Date de l'export (UTC) : « 20 oct. 2026, 10:36:04 » (compte en français), « Oct 20, 2026, 10:36:04 AM » (anglais) ou ISO. */
export function parseStravaDate(raw: string): Date | null {
  const s = norm(raw).replace(/\./g, "");
  let m = s.match(/^(\d{1,2}) ([a-z]+) (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  let day: number, mon: string, year: number, h: number, min: number, sec: number;
  if (m) { day = +m[1]; mon = m[2]; year = +m[3]; h = +m[4]; min = +m[5]; sec = +(m[6] ?? 0); }
  else {
    m = s.match(/^([a-z]+) (\d{1,2}),? (\d{4}),? (\d{1,2}):(\d{2})(?::(\d{2}))?(?: ?(am|pm))?$/);
    if (!m) { const t = Date.parse(raw); return Number.isFinite(t) ? new Date(t) : null; }
    mon = m[1]; day = +m[2]; year = +m[3]; h = +m[4]; min = +m[5]; sec = +(m[6] ?? 0);
    if (m[7] === "pm" && h < 12) h += 12;
    if (m[7] === "am" && h === 12) h = 0;
  }
  const month = MONTHS[mon];
  if (month == null) return null;
  const d = new Date(Date.UTC(year, month, day, h, min, sec));
  return Number.isFinite(+d) ? d : null;
}

export type StravaRow = {
  id: string;
  /** Date brute de la colonne, pour le rapport. */
  rawDate: string;
  startedAt: Date | null;
  name: string;
  type: string;
  description: string;
  commute: boolean;
  /** Chemin relatif dans l'archive (« activities/123.gpx.gz »), null pour une activité saisie à la main. */
  file: string | null;
  elapsedS?: number;
  movingS?: number;
  distanceM?: number;
  elevationM?: number;
  avgHr?: number;
  maxHr?: number;
  avgPower?: number;
  maxPower?: number;
  calories?: number;
  /** Course (compétition) selon Strava : colonne « Compétition » ou type d'entraînement « Course » (workout_type 1). */
  isRace: boolean;
};

// En-têtes (français ou anglais, sans accents ni casse). L'export répète certains titres (Distance, Temps écoulé, FC max) :
// la première colonne est arrondie / en km, la seconde est précise ; on lit les occurrences de la dernière à la première.
const COLS = {
  id: ["id de l'activite", "activity id"],
  date: ["date de l'activite", "activity date"],
  name: ["nom de l'activite", "activity name"],
  type: ["type d'activite", "activity type"],
  description: ["description de l'activite", "activity description"],
  commute: ["deplacement-transport", "commute"],
  file: ["nom du fichier", "filename"],
  elapsed: ["temps ecoule", "elapsed time"],
  moving: ["duree de deplacement", "moving time"],
  distance: ["distance"],
  elevation: ["denivele positif", "elevation gain"],
  maxHr: ["frequence cardiaque max.", "max heart rate"],
  avgHr: ["frequence cardiaque moyenne", "average heart rate"],
  maxPower: ["puissance max.", "max watts"],
  avgPower: ["puissance moyenne", "average watts"],
  calories: ["calories"],
  // Absentes des anciens exports : sans elles, isRace reste false.
  competition: ["competition", "race"],
  workoutType: ["type d'entrainement", "workout type"],
} as const;
const REQUIRED: (keyof typeof COLS)[] = ["id", "date", "type"];

/** « true » / « vrai » / « 1 » (case Compétition) ; pour le type d'entraînement : 1 ou « Course » (workout_type Strava : 0 défaut, 1 course, 2 sortie longue, 3 séance). */
const isRaceFlag = (v: string) => /^(true|vrai|oui|1|race|course|competition)$/i.test(norm(v));

export function readStravaCsv(text: string): { rows: StravaRow[]; missing: string[] } {
  const table = parseCsv(text);
  if (!table.length) return { rows: [], missing: [...REQUIRED] };
  const where = new Map<string, number[]>();
  table[0].forEach((h, i) => { const k = norm(h); where.set(k, [...(where.get(k) ?? []), i]); });
  const cols = (key: keyof typeof COLS) => COLS[key].flatMap((n) => where.get(n) ?? []).sort((a, b) => b - a);
  const missing = REQUIRED.filter((k) => !cols(k).length);
  if (missing.length) return { rows: [], missing };

  const str = (r: string[], key: keyof typeof COLS) => { for (const i of cols(key)) if (r[i]?.trim()) return r[i].trim(); return ""; };
  const numOf = (r: string[], key: keyof typeof COLS) => { for (const i of cols(key)) { const v = parseNumber(r[i]); if (v != null) return v; } return undefined; };

  const rows = table.slice(1).map((r): StravaRow => {
    const rawDate = str(r, "date");
    return {
      id: str(r, "id"), rawDate, startedAt: parseStravaDate(rawDate),
      name: str(r, "name"), type: str(r, "type"), description: str(r, "description"),
      commute: /^(true|vrai|oui|1)$/i.test(str(r, "commute")),
      file: str(r, "file") || null,
      elapsedS: numOf(r, "elapsed"), movingS: numOf(r, "moving"), distanceM: numOf(r, "distance"), elevationM: numOf(r, "elevation"),
      isRace: isRaceFlag(str(r, "competition")) || isRaceFlag(str(r, "workoutType")),
      avgHr: numOf(r, "avgHr"), maxHr: numOf(r, "maxHr"), avgPower: numOf(r, "avgPower"), maxPower: numOf(r, "maxPower"), calories: numOf(r, "calories"),
    };
  });
  return { rows: rows.filter((r) => r.id), missing: [] };
}

// ───────── Types de sport ─────────

const TYPES: { kind: ActivityKind; names: string[] }[] = [
  { kind: "RUN", names: ["course a pied", "run", "trail", "course de trail", "trail run", "virtual run", "course a pied virtuelle", "tapis de course"] },
  { kind: "EBIKE", names: ["velo electrique", "e-bike ride", "ebike ride", "e-mountain bike ride", "velo tout-terrain electrique", "velo de montagne electrique"] },
  { kind: "RIDE", names: ["velo", "ride", "velo virtuel", "virtual ride", "velo tout-terrain", "mountain bike ride", "velo de gravel", "gravel ride", "velo de route", "velo de montagne", "velo d'appartement"] },
  { kind: "HIKE", names: ["randonnee", "hike"] },
  { kind: "WALK", names: ["marche", "walk"] },
  { kind: "WORKOUT", names: ["musculation", "weight training", "renforcement musculaire", "entrainement", "workout", "crossfit", "hiit", "entrainement en circuit"] },
  { kind: "SWIM", names: ["natation", "swim"] },
];

/** Types que l'on choisit de ne pas importer (signalés dans le rapport). */
export const EXCLUDED_TYPES = ["escalade", "rock climbing"];
export const isExcludedType = (type: string) => EXCLUDED_TYPES.includes(norm(type));

export type MappedType = { kind: ActivityKind; known: boolean; commute: boolean };

/**
 * Type Strava → sport Pulse. Un vélotaf (case « Déplacement-transport ») devient EBIKE, comme les vélotafs de Google Fit :
 * c'est ce type qui en fait une activité « douce » (lib/sports.ts), hors séances d'entraînement. La marche l'est déjà.
 * Un type inconnu devient OTHER avec known = false : l'appelant le signale, il n'est jamais écarté.
 */
export function mapStravaType(type: string, commute = false): MappedType {
  const t = norm(type);
  const hit = TYPES.find((x) => x.names.includes(t));
  if (!hit) return { kind: "OTHER", known: false, commute: false };
  if (commute && hit.kind === "RIDE") return { kind: "EBIKE", known: true, commute: true };
  return { kind: hit.kind, known: true, commute: commute && (hit.kind === "EBIKE" || hit.kind === "WALK") };
}

// ───────── Activité Pulse ─────────

export const stravaKey = (id: string) => `strava-${id}`;

/** Fusionne la ligne du CSV et le fichier lu : valeurs de Strava pour durée, distance et dénivelé, mesures du fichier pour le reste. Sans fichier, le CSV seul. */
export function toParsed(row: StravaRow, file: ParsedActivity | null): ParsedActivity {
  const started = file?.startedAt ?? row.startedAt?.toISOString();
  if (!started) throw new Error(`date illisible « ${row.rawDate} »`);
  const pos = (v: number | undefined) => (v != null && v > 0 ? v : undefined);
  const moving = pos(row.movingS) ?? pos(file?.movingTimeS) ?? pos(row.elapsedS) ?? 0;
  if (moving <= 0) throw new Error("durée nulle");
  const { kind } = mapStravaType(row.type, row.commute);
  return {
    dedupeKey: stravaKey(row.id), externalId: row.id, source: "strava", fileName: row.file ?? "",
    type: kind, title: row.name || file?.title || "Activité Strava", notes: row.description.slice(0, 2000) || undefined,
    startedAt: started,
    distanceM: pos(row.distanceM) ?? file?.distanceM ?? 0,
    movingTimeS: moving, elapsedTimeS: pos(row.elapsedS) ?? file?.elapsedTimeS ?? moving,
    elevationGainM: row.elevationM ?? file?.elevationGainM ?? 0,
    avgHr: file?.avgHr ?? pos(row.avgHr), maxHr: file?.maxHr ?? pos(row.maxHr),
    avgPower: file?.avgPower ?? pos(row.avgPower), maxPower: file?.maxPower ?? pos(row.maxPower),
    calories: file?.calories ?? pos(row.calories),
    isRace: row.isRace || undefined,
    startLat: file?.startLat, startLng: file?.startLng, points: file?.points ?? [],
  };
}

// ───────── Doublons ─────────

export type KnownActivity = {
  id: string; type: string; title: string; startedAt: Date; movingTimeS: number; elapsedTimeS: number | null; source: string; dedupeKey: string | null;
};
export type Candidate = { type: string; startedAt: Date; movingTimeS: number; elapsedTimeS: number | null };
export type DuplicateMatch = { existing: KnownActivity; reason: "debut+duree" | "chevauchement"; startDiffS: number };

/** Vélo avec ou sans assistance, marche et randonnée : un même trajet peut arriver sous l'un ou l'autre selon la source. */
const FAMILY: Record<string, string> = { RIDE: "bike", EBIKE: "bike", WALK: "foot", HIKE: "foot" };
const familyOf = (t: string) => FAMILY[t] ?? t;

export const START_TOLERANCE_S = 5 * 60;
const close = (a: number, b: number) => a > 0 && b > 0 && (Math.abs(a - b) <= 120 || Math.min(a, b) / Math.max(a, b) >= 0.8);
const durations = (a: { movingTimeS: number; elapsedTimeS: number | null }) => [a.movingTimeS, a.elapsedTimeS ?? 0];

/**
 * Même sport (famille), début à ±5 min et durée proche (temps de déplacement ou écoulé, à 2 min ou 20 % près) ;
 * à défaut, recouvrement de plus de 70 % (même seuil que le pipeline post-import, qui fusionnerait sinon une activité existante).
 * Renvoie la correspondance au départ le plus proche.
 */
export function findDuplicate(c: Candidate, existing: KnownActivity[]): DuplicateMatch | null {
  let best: DuplicateMatch | null = null;
  for (const e of existing) {
    if (familyOf(e.type) !== familyOf(c.type)) continue;
    const startDiffS = Math.abs(+e.startedAt - +c.startedAt) / 1000;
    const sameDuration = durations(c).some((x) => durations(e).some((y) => close(x, y)));
    const reason = startDiffS <= START_TOLERANCE_S && sameDuration ? "debut+duree" as const
      : overlapRatio(e, c) > OVERLAP_RATIO ? "chevauchement" as const : null;
    if (reason && (!best || startDiffS < best.startDiffS)) best = { existing: e, reason, startDiffS };
  }
  return best;
}
