import { dayKey, shiftDay, weekKeys } from "../dates";
import { getCountdown, raceDayKey, RACE_TZ, type RaceWhen } from "./time";
import { fmtGoalPace } from "./format";

/**
 * Préparation d'une course à venir : phase, volume hebdo, plus longue sortie, régularité, conseils.
 * Fonctions pures (aucun accès base) : testées dans tools/test-race-prep.ts.
 */

export type PrepActivity = { type: string; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number };
export type PrepRace = RaceWhen & { sport: string; targetDistance: number | null; targetElevation: number | null; goalTimeS?: number | null };

export type Phase = "Base" | "Construction" | "Affûtage" | "Semaine de course" | "Jour J";
export type PrepState = "En avance" | "Dans le rythme" | "À relancer";
export type Band = { lo: number; hi: number };
export type PrepWeek = { start: string; km: number; dPlus: number; count: number; timeS: number; current: boolean; future: boolean; phase: Phase; target: Band | null };

const WEEKS_BACK = 12;
const r1 = (n: number) => Math.round(n * 10) / 10;
const fr = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });

/** Activités prises en compte : même sport (la rando compte aussi la marche). */
export const prepSports = (sport: string) => (sport === "HIKE" || sport === "WALK" ? ["HIKE", "WALK"] : [sport]);

/** Affûtage : 3 semaines au-delà du semi, 2 semaines sinon. */
export const taperDays = (km: number | null) => ((km ?? 0) >= 21 ? 21 : 14);

/** Phase selon le nombre de jours calendaires avant le jour J. */
export function racePhase(daysLeft: number, km: number | null): Phase {
  if (daysLeft <= 0) return "Jour J";
  if (daysLeft <= 6) return "Semaine de course";
  if (daysLeft <= taperDays(km)) return "Affûtage";
  if (daysLeft <= 56) return "Construction";
  return "Base";
}

/**
 * Volume hebdo indicatif (km) : 1,5 à 2× la distance en construction (min. 15 km), ×0,8 en base,
 * −40 % en affûtage, −60 % la semaine de course.
 */
export function targetVolume(phase: Phase, km: number | null): Band | null {
  if (!km || km <= 0 || phase === "Jour J") return null;
  const lo = Math.max(15, 1.5 * km), hi = Math.max(lo + 5, 2 * km);
  const f = phase === "Base" ? 0.8 : phase === "Affûtage" ? 0.6 : phase === "Semaine de course" ? 0.4 : 1;
  return { lo: r1(lo * f), hi: r1(hi * f) };
}

/** Plus longue sortie attendue (part de la distance) selon la phase. */
const expectedLong = (p: Phase) => (p === "Base" ? 0.5 : p === "Construction" ? 0.75 : 0.85);

export type RacePrep = {
  daysLeft: number; weeksLeft: number; phase: Phase; state: PrepState;
  weeks: PrepWeek[]; // 12 semaines passées (dont la semaine en cours) puis les semaines restantes
  thisWeek: { km: number; dPlus: number; count: number; timeS: number };
  avgKm: number; // moyenne des 3 dernières semaines complètes
  target: Band | null;
  longest: { km: number; ratio: number | null; next: number | null };
  regularity: { weeks: number; of: number };
  elevation: { bestWeek: number; target: number; ratio: number } | null;
  pace: { goal: string; goalS: number; recent: string | null; recentS: number | null; n: number } | null;
  tips: string[];
};

/** Allure moyenne (s/km) des sorties récentes de distance proche (±30 %), sur 8 semaines. */
function recentPace(acts: PrepActivity[], km: number, now: Date) {
  const near = acts.filter((a) => +now - +a.startedAt <= 56 * 864e5 && a.distanceM > 0 && a.movingTimeS > 0 && Math.abs(a.distanceM / 1000 - km) <= 0.3 * km);
  const d = near.reduce((s, a) => s + a.distanceM, 0) / 1000, t = near.reduce((s, a) => s + a.movingTimeS, 0);
  return { s: near.length ? t / d : null, n: near.length };
}

export function racePrep(race: PrepRace, allActs: PrepActivity[], now: Date = new Date(), tz = RACE_TZ): RacePrep {
  const km = race.targetDistance && race.targetDistance > 0 ? race.targetDistance : null;
  const sports = prepSports(race.sport);
  const acts = allActs.filter((a) => sports.includes(a.type) && a.startedAt <= now);
  const daysLeft = Math.max(0, getCountdown(race, now).days);
  const phase = racePhase(daysLeft, km);
  const raceKey = raceDayKey(race.date);
  const daysTo = (k: string) => Math.round((Date.parse(raceKey) - Date.parse(k)) / 864e5);

  // Semaines lundi→dimanche dans le fuseau de l'utilisateur.
  const byDay = new Map<string, PrepActivity[]>();
  for (const a of acts) { const k = dayKey(a.startedAt, tz); byDay.set(k, [...(byDay.get(k) ?? []), a]); }
  const weekOf = (offset: number, future: boolean): PrepWeek => {
    const keys = weekKeys(now, tz, offset), list = keys.flatMap((k) => byDay.get(k) ?? []);
    // Phase de la semaine : vue depuis son lundi (ou aujourd'hui pour la semaine en cours).
    const ph = offset === 0 ? phase : racePhase(daysTo(keys[0]), km);
    return {
      start: keys[0], current: offset === 0, future, phase: ph, target: targetVolume(ph, km),
      km: r1(list.reduce((s, a) => s + a.distanceM, 0) / 1000), dPlus: Math.round(list.reduce((s, a) => s + a.elevationGainM, 0)),
      count: list.length, timeS: list.reduce((s, a) => s + a.movingTimeS, 0),
    };
  };
  const past = Array.from({ length: WEEKS_BACK }, (_, i) => weekOf(i - WEEKS_BACK + 1, false));
  const raceMonday = weekKeys(new Date(`${raceKey}T12:00:00Z`), "UTC")[0];
  const futureCount = Math.max(0, Math.round((Date.parse(raceMonday) - Date.parse(past.at(-1)!.start)) / (7 * 864e5)));
  const future = Array.from({ length: futureCount }, (_, i) => ({ ...weekOf(i + 1, true), km: 0, dPlus: 0, count: 0, timeS: 0 }));
  const cur = past.at(-1)!, full = past.slice(0, -1);

  const avgKm = r1(full.slice(-3).reduce((s, w) => s + w.km, 0) / 3);
  const target = targetVolume(phase, km);
  const since28 = shiftDay(dayKey(now, tz), -27);
  const longestKm = r1(acts.filter((a) => dayKey(a.startedAt, tz) >= since28).reduce((m, a) => Math.max(m, a.distanceM / 1000), 0));
  const ratio = km ? longestKm / km : null;
  // Prochaine sortie longue : +20 % (au moins +1 km), sans dépasser la distance de course.
  const next = km ? Math.min(Math.round(km), Math.max(longestKm ? Math.round(longestKm * 1.2) : Math.max(3, Math.round(km * 0.4)), Math.round(longestKm) + 1)) : null;
  // Régularité : semaines complètes avec ≥ 2 sorties ; la semaine en cours ne compte que si elle est déjà validée.
  const last6 = cur.count >= 2 ? [...full.slice(-5), cur] : full.slice(-6);
  const regularity = { weeks: last6.filter((w) => w.count >= 2).length, of: 6 };
  const elevation = race.targetElevation && race.targetElevation > 0
    ? (() => { const bestWeek = Math.max(0, ...[...full.slice(-3), cur].map((w) => w.dPlus)); return { bestWeek, target: Math.round(race.targetElevation!), ratio: bestWeek / race.targetElevation! }; })()
    : null;

  let pace: RacePrep["pace"] = null;
  if (race.goalTimeS && km) {
    const rp = recentPace(acts, km, now);
    pace = {
      goal: fmtGoalPace(race.goalTimeS, km, race.sport)!, goalS: race.goalTimeS / km,
      recent: rp.s ? fmtGoalPace(rp.s * km, km, race.sport) : null, recentS: rp.s, n: rp.n,
    };
  }

  // État global : volume, sortie longue et régularité, chacun −1 / 0 / +1.
  const lead = phase === "Affûtage" || phase === "Semaine de course" || phase === "Jour J";
  const sVol = !target ? 0 : avgKm >= target.hi ? 1 : avgKm >= target.lo * 0.75 ? 0 : lead && avgKm >= target.lo * 0.5 ? 0 : -1;
  const sLong = ratio == null ? 0 : ratio >= expectedLong(phase) + 0.15 ? 1 : ratio >= expectedLong(phase) - 0.15 ? 0 : -1;
  const sReg = regularity.weeks >= 5 ? 1 : regularity.weeks >= 3 ? 0 : -1;
  const score = sVol + sLong + sReg;
  // Loin de la course, il reste du temps : on ne parle de relance qu’en cas de vraie pause ; en affûtage, trop tard pour relancer, on ne le dit pas.
  const state: PrepState = score >= 2 ? "En avance" : !lead && score <= (phase === "Base" ? -3 : -2) ? "À relancer" : "Dans le rythme";

  // Conseils par règles, du plus utile au plus général ; 3 au maximum.
  const tips: string[] = [];
  if (phase === "Jour J") tips.push("C’est le grand jour : pars prudemment, monte en régime ensuite et savoure.");
  else if (phase === "Semaine de course") tips.push("Semaine de course : deux sorties courtes et faciles suffisent, garde des jambes fraîches.");
  else if (phase === "Affûtage") tips.push(`Tu es en affûtage : garde l’intensité, baisse le volume${target ? ` (autour de ${fr(target.lo, 0)} km cette semaine)` : ""}.`);
  if (km && ratio != null && !lead) {
    if (longestKm === 0) tips.push(`Pas encore de sortie récente : commence par ${next} km tranquilles, l’important est de s’y remettre.`);
    else if (ratio < 1 && ratio < expectedLong(phase) + 0.15) tips.push(`Ta plus longue sortie est à ${Math.round(ratio * 100)} % de la distance : vise une sortie de ${next} km ce week-end.`);
    else if (ratio >= 1) tips.push(`Tu as déjà couvert la distance (${fr(longestKm)} km) : place maintenant des passages à allure course.`);
  }
  if (elevation && elevation.ratio < 1 && phase !== "Jour J") tips.push(`Pense au D+ : ${elevation.target} m prévus le jour J, glisse une sortie vallonnée dans ta semaine.`);
  if (target && !lead && avgKm < target.lo) tips.push(`Monte en douceur vers ${fr(target.lo, 0)}–${fr(target.hi, 0)} km par semaine (+10 % max d’une semaine à l’autre).`);
  if (regularity.weeks < 4 && !lead) tips.push("Vise 2 sorties par semaine : la régularité paie plus que les grosses semaines.");
  if (pace?.recentS && phase !== "Jour J") {
    tips.push(pace.recentS <= pace.goalS ? `Ton allure récente (${pace.recent}) est déjà dans l’objectif : continue comme ça.` : `Ajoute une séance par semaine avec des blocs à ${pace.goal}, ton allure cible.`);
  }
  if (!tips.length) tips.push("Belle régularité : continue sur cette lancée.");

  return {
    daysLeft, weeksLeft: Math.floor(daysLeft / 7), phase, state, weeks: [...past, ...future],
    thisWeek: { km: cur.km, dPlus: cur.dPlus, count: cur.count, timeS: cur.timeS },
    avgKm, target, longest: { km: longestKm, ratio, next }, regularity, elevation, pace, tips: tips.slice(0, 3),
  };
}

/** Résumé d'une ligne pour la carte du dashboard : « Construction · Dans le rythme · 18 km cette semaine ». */
export const prepLine = (p: Pick<RacePrep, "phase" | "state" | "thisWeek">) =>
  p.phase === "Jour J" ? "Jour J · bonne course !" : `${p.phase} · ${p.state} · ${fr(p.thisWeek.km)} km cette semaine`;

/** Objectif hebdo proposé pour la course : milieu de la fourchette de construction, arrondi au km. */
export const weeklyGoalKm = (km: number | null) => { const b = targetVolume("Construction", km); return b ? Math.round((b.lo + b.hi) / 2) : null; };
