/**
 * Records personnels PAR SPORT (page Vous). Pure : tout vient de ce qu'on lui passe (tests : tools/test-records.ts).
 * - Endurance : les PersonalRecord déjà calculés à l'import (5 km, 10 km, semi = meilleur effort DANS la sortie, pas sortie entière ;
 *   plus longue sortie, plus gros D+). Jamais de record pour un E-bike (lib/pipeline/post-import.ts).
 * - Vélo : en plus, meilleure puissance moyenne sur 20 min (ActivityStream.curve).
 * - Muscu : par exercice (et par variante Lafay : B1 et B2 ne se comparent pas) : la meilleure série en répétitions (le total de la séance en précision),
 *   pour un exercice chargé la série la plus lourde, pour un exercice au chrono (gainage, planche) la plus longue tenue, en secondes (« 1 min 30 »).
 */
import { dayKey } from "../dates";
import { fmtClock, fmtKm, fmtNum } from "../format";
import { doneSets, groupKey, sumReps, variantOf, type StrengthRow } from "./strength";
import { catalogFor, isLafayCode, resolveName } from "../workout/catalog";

export type RecordSport = "WORKOUT" | "RUN" | "RIDE" | "HIKE";
/** Ordre des onglets : Running, Muscu, Vélo, Rando. */
export const RECORD_SPORTS: readonly RecordSport[] = ["RUN", "WORKOUT", "RIDE", "HIKE"];

export type RecordRow = {
  key: string;
  label: string;
  value: string;
  unit: string;            // « km », « W », « reps »… (vide pour un chrono)
  day: string;             // « 12 oct. 2026 »
  sub: string | null;      // précision affichée après la date
  code?: string;           // pastille : « 5K », « 10K », « 21,1 » (course) ; code Lafay (« B2 ») en muscu
  activityId: string | null;
};
export type SportRecords = { sport: RecordSport; rows: RecordRow[] };
export type RecordsBySport = { sports: SportRecords[]; defaultSport: RecordSport | null };

export type RecordInput = {
  tz: string;
  prs: { kind: string; type: string; value: number; activityId: string | null; achievedAt: Date }[];
  /** Courbes de puissance des sorties VÉLO : [5 s, 30 s, 1 min, 5 min, 20 min, 1 h] (lib/power.ts). */
  curves: { activityId: string; startedAt: Date; curve: (number | null)[] | null }[];
  strength: StrengthRow[];
};

const fmtDay = (d: Date, tz: string) =>
  new Date(dayKey(d, tz) + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

type Fmt = (v: number) => { value: string; unit: string };
const time: Fmt = (v) => ({ value: fmtClock(v), unit: "" });
const km: Fmt = (v) => ({ value: fmtKm(v), unit: "km" });
const dplus: Fmt = (v) => ({ value: fmtNum(v, 0), unit: "m" });

const LONGEST = { kind: "LONGEST_DISTANCE", label: "Plus longue sortie", fmt: km } as const;
const CLIMB = { kind: "BEST_ELEVATION", label: "Plus gros D+", fmt: dplus } as const;
/** Pastille des records de course : la distance de l'effort. */
const RUN_CODE: Record<string, string> = { BEST_5K: "5K", BEST_10K: "10K", BEST_HALF: "21,1" };
const ENDURANCE: Record<Exclude<RecordSport, "WORKOUT">, readonly { kind: string; label: string; fmt: Fmt }[]> = {
  RUN: [{ kind: "BEST_5K", label: "Meilleur 5 km", fmt: time }, { kind: "BEST_10K", label: "Meilleur 10 km", fmt: time }, { kind: "BEST_HALF", label: "Meilleur semi-marathon", fmt: time }, LONGEST, CLIMB],
  RIDE: [LONGEST, CLIMB],
  HIKE: [LONGEST, CLIMB],
};

function enduranceRows(sport: Exclude<RecordSport, "WORKOUT">, input: RecordInput): RecordRow[] {
  const rows: RecordRow[] = [];
  for (const def of ENDURANCE[sport]) {
    const pr = input.prs.find((p) => p.type === sport && p.kind === def.kind);
    if (!pr || !(pr.value > 0)) continue;
    const f = def.fmt(pr.value);
    rows.push({ key: `${sport}:${def.kind}`, label: def.label, value: f.value, unit: f.unit, day: fmtDay(pr.achievedAt, input.tz), sub: null, activityId: pr.activityId, ...(sport === "RUN" && RUN_CODE[def.kind] ? { code: RUN_CODE[def.kind] } : {}) });
  }
  if (sport === "RIDE") {
    let best: { w: number; id: string; at: Date } | null = null;
    for (const c of input.curves) { const w = c.curve?.[4] ?? 0; if (w > (best?.w ?? 0)) best = { w, id: c.activityId, at: c.startedAt }; }
    if (best) rows.push({ key: "RIDE:POWER20", label: "Meilleure puissance 20 min", value: String(Math.round(best.w)), unit: "W", day: fmtDay(best.at, input.tz), sub: null, activityId: best.id });
  }
  return rows;
}

/** Un exercice Lafay change de nom en changeant de variante : B1 et B2 ont chacun leur record. */
const recordKey = (name: string) => `${groupKey(name)}|${variantOf(name) ?? ""}`;
const latestFirst = (a: StrengthRow, b: StrengthRow) => +b.startedAt - +a.startedAt;
const MAX_STRENGTH_ROWS = 12;

/** Exercice au chrono : l'unité du catalogue (mode « time ») ; hors catalogue, le nom (gainage, planche, tenue…). Les « reps » enregistrées sont alors des secondes. */
export function isTimedExercise(name: string): boolean {
  const { code, variant } = resolveName(name);
  const e = catalogFor(code, variant);
  return e ? e.mode === "time" : /gainage|planche|plank|tenue|isom[ée]tr/i.test(name);
}

/** 90 → « 1 min 30 », 120 → « 2 min », 45 → « 45 s ». */
export function fmtHold(s: number): string {
  const t = Math.round(s), m = Math.floor(t / 60), r = t % 60;
  return m === 0 ? `${r} s` : r === 0 ? `${m} min` : `${m} min ${String(r).padStart(2, "0")}`;
}

export function strengthRecords(rows: StrengthRow[], tz: string): RecordRow[] {
  const groups = new Map<string, StrengthRow[]>();
  for (const r of [...rows].sort(latestFirst)) {
    const k = recordKey(r.name);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const out: { row: RecordRow; last: number }[] = [];
  for (const [k, list] of groups) {
    const sets = list.flatMap((r) => doneSets(r).map((s) => ({ r, s })));
    if (!sets.length) continue;
    const name = list[0].name.trim(), variant = variantOf(name);
    const label = variant && !name.toUpperCase().startsWith(variant) ? `${name} (${variant})` : name;

    // Total de répétitions par séance (un exercice peut apparaître plusieurs fois dans la même activité)
    const perSession = new Map<string, { total: number; best: number; at: Date }>();
    for (const r of list) {
      const d = doneSets(r);
      if (!d.length) continue;
      const cur = perSession.get(r.activityId) ?? { total: 0, best: 0, at: r.startedAt };
      cur.total += sumReps(d); cur.best = Math.max(cur.best, ...d.map((s) => s.reps));
      perSession.set(r.activityId, cur);
    }
    const loaded = sets.filter(({ s }) => (s.loadKg ?? 0) > 0);
    let row: RecordRow | null = null;
    if (isTimedExercise(name)) {
      // Chrono : la plus longue tenue sur une série (secondes), jamais des répétitions.
      const [id, top] = [...perSession].reduce((b, x) => (x[1].best > b[1].best ? x : b));
      if (top.best > 0) row = { key: k, label, value: fmtHold(top.best), unit: "", day: fmtDay(top.at, tz), sub: null, activityId: id };
    } else if (loaded.length) {
      // Exercice chargé (haltères, barre, lesté) : la série la plus lourde, à charge égale la plus longue
      const top = loaded.reduce((b, x) => (x.s.loadKg! > b.s.loadKg! || (x.s.loadKg === b.s.loadKg && x.s.reps > b.s.reps) ? x : b));
      row = { key: k, label, value: fmtNum(top.s.loadKg!, 1), unit: `kg × ${top.s.reps}`, day: fmtDay(top.r.startedAt, tz), sub: null, activityId: top.r.activityId };
    } else {
      // Répétitions : titre = la meilleure série ; précision = total de la séance où elle a été faite (à égalité, la plus fournie).
      const [id, top] = [...perSession].reduce((b, x) => (x[1].best > b[1].best || (x[1].best === b[1].best && x[1].total > b[1].total) ? x : b));
      if (top.best > 0) row = { key: k, label, value: String(top.best), unit: "reps", day: fmtDay(top.at, tz), sub: `${top.total} sur la séance`, activityId: id };
    }
    if (row) { const { code, variant } = resolveName(name); if (variant || isLafayCode(code)) row.code = variant ?? code; }
    if (row) out.push({ row, last: +list[0].startedAt });
  }
  return out.sort((a, b) => b.last - a.last).slice(0, MAX_STRENGTH_ROWS).map((x) => x.row);
}

export function buildSportRecords(input: RecordInput): RecordsBySport {
  const sports = RECORD_SPORTS
    .map((sport): SportRecords => ({ sport, rows: sport === "WORKOUT" ? strengthRecords(input.strength, input.tz) : enduranceRows(sport, input) }))
    .filter((s) => s.rows.length > 0);
  // Onglet par défaut : Running s'il a des records, sinon le premier onglet disponible
  return { sports, defaultSport: sports[0]?.sport ?? null };
}
