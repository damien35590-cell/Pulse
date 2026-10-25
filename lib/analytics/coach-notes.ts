/**
 * « Le mot du coach » de la page Analyse : 2 à 4 commentaires tirés des chiffres de la période choisie,
 * comparés à la période précédente de même durée, à tes cibles (2–3 courses + 2–3 muscu par semaine) et à tes programmes.
 * Règles déterministes, aucun appel d'IA : chaque règle ne parle que si elle a quelque chose d'utile à dire.
 * Fonctions pures (tests : tools/test-coach-notes.ts).
 */
import { dayKey, shiftDay } from "../dates";
import { fitnessSeries } from "../fitness";
import { estimateLoad } from "../load";
import { isCommute } from "../routes/estimate";
import { fmtClock, fmtPaceS } from "../format";
import type { StrengthAnalysis } from "./strength";

export type CoachTone = "good" | "warn" | "bad" | "info";
export type CoachNote = { id: string; tone: CoachTone; title: string; body: string; action?: { label: string; href: string } };

/** Période analysée : `now` = fin de période ; `current` = elle se termine aujourd'hui. */
export type CoachPeriod = { weeks: number; tz: string; now: Date; current: boolean };
/** Suivi d'un programme sur la période (séances prévues jusqu'à hier). */
export type PlanAdherence = { sport: "RUN" | "WORKOUT"; name: string; planned: number; done: number; missedKey: number };
export type RunGoal = { title: string; distanceM: number | null; targetTimeS: number | null; predictedTimeS: number | null };
export type CoachAct = { type: string; title: string; source: string; dedupeKey: string | null; startedAt: Date; distanceM: number; movingTimeS: number; load: number | null };

/** Cibles hebdomadaires que tu t'es fixées. */
export const TARGET_RUNS: readonly [number, number] = [2, 3];
export const TARGET_LIFTS: readonly [number, number] = [2, 3];
const TARGET_ALL: readonly [number, number] = [TARGET_RUNS[0] + TARGET_LIFTS[0], TARGET_RUNS[1] + TARGET_LIFTS[1]];
/** Nombre maximal de commentaires affichés. */
export const MAX_NOTES = 4;

const RANK: Record<CoachTone, number> = { bad: 0, warn: 1, good: 2, info: 3 };
const fr = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
const hours = (s: number) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`; };
const plural = (n: number, w: string) => `${fr(n, n % 1 ? 1 : 0)} ${w}${n >= 2 ? "s" : ""}`;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** Les plus importants d'abord (alerte, vigilance, progrès, info), dans l'ordre des règles à importance égale. */
export function rankNotes(notes: CoachNote[], max = MAX_NOTES): CoachNote[] {
  return notes.map((n, i) => ({ n, i })).sort((a, b) => RANK[a.n.tone] - RANK[b.n.tone] || a.i - b.i).slice(0, max).map((x) => x.n);
}

/** Bornes utiles d'une période : jours de la période, période précédente, semaines terminées. */
export function frame(p: CoachPeriod) {
  const endKey = dayKey(p.now, p.tz);
  const dow = (new Date(endKey + "T12:00:00Z").getUTCDay() + 6) % 7;
  const endMon = shiftDay(endKey, -dow), startKey = shiftDay(endMon, -7 * (p.weeks - 1));
  const prevStart = shiftDay(startKey, -7 * p.weeks), prevEnd = shiftDay(startKey, -1);
  const span = days(startKey, endKey) + 1; // jours écoulés : la semaine en cours n'est pas finie
  // Semaines terminées : la semaine en cours n'est comptée que si elle est finie (dimanche)
  const fullWeeks = p.current && dow < 6 ? p.weeks - 1 : p.weeks;
  return { endKey, startKey, prevStart, prevEnd, span, prevSpan: 7 * p.weeks, fullWeeks, lastFullMon: fullWeeks === p.weeks ? endMon : shiftDay(endMon, -7) };
}

/**
 * Sorties par semaine : activités / semaines terminées de la période (la semaine en cours n'est comptée que si elle est finie).
 * Source unique du coach et de la page Analyse. `acts` = les activités de la période, déjà filtrées par sport. null sans semaine terminée.
 */
export function sessionsPerWeek(acts: { startedAt: Date }[], p: CoachPeriod): number | null {
  const f = frame(p);
  if (f.fullWeeks < 1) return null;
  const fullEnd = shiftDay(f.lastFullMon, 6);
  return acts.filter((a) => { const k = dayKey(a.startedAt, p.tz); return k >= f.startKey && k <= fullEnd; }).length / f.fullWeeks;
}

/** Variation en %, à durée égale (la période en cours peut être plus courte que la précédente). null sans référence. */
export function rateChange(cur: number, curDays: number, prev: number, prevDays: number): number | null {
  if (prev <= 0 || curDays <= 0) return null;
  return Math.round(((cur / curDays - prev / prevDays) / (prev / prevDays)) * 100);
}

/** Commentaires de suivi des programmes actifs. */
export function planNotes(plans: PlanAdherence[]): CoachNote[] {
  const out: CoachNote[] = [];
  for (const p of plans) {
    if (p.planned < 2) continue;
    const pct = Math.round((p.done / p.planned) * 100);
    const ks = p.missedKey > 1 ? "s" : "";
    const key = p.missedKey ? ` Dont ${p.missedKey} séance${ks} clé${ks} manquée${ks} : ce sont elles qui font progresser, cale-les en priorité.` : "";
    const base = `${p.done} séance${p.done > 1 ? "s" : ""} faite${p.done > 1 ? "s" : ""} sur ${p.planned} prévues dans « ${p.name} ».`;
    if (pct >= 80) out.push({ id: `plan-${p.sport}`, tone: "good", title: `Programme suivi à ${pct} %`, body: base + (key || " Continue comme ça, c'est la régularité qui paie.") });
    else out.push({
      id: `plan-${p.sport}`, tone: pct < 50 ? "bad" : "warn", title: `Programme suivi à ${pct} %`,
      body: `${base}${key || " Mieux vaut une séance raccourcie qu'une séance sautée."}`, action: { label: "Voir le programme", href: "/plan" },
    });
  }
  return out;
}

// ───────── Onglet « Tous » ─────────

export function overviewNotes(input: { acts: CoachAct[]; period: CoachPeriod; plans?: PlanAdherence[] }): CoachNote[] {
  const { acts, period: p, plans = [] } = input;
  const f = frame(p), notes: CoachNote[] = [];
  const training = acts.filter((a) => !isCommute({ ...a }) && +a.startedAt <= +p.now);
  const between = (a: CoachAct, from: string, to: string) => { const k = dayKey(a.startedAt, p.tz); return k >= from && k <= to; };
  const cur = training.filter((a) => between(a, f.startKey, f.endKey)), prev = training.filter((a) => between(a, f.prevStart, f.prevEnd));
  const time = (l: CoachAct[]) => l.reduce((s, a) => s + a.movingTimeS, 0);

  // 1. Absence prolongée d'une discipline que tu pratiques (période en cours seulement)
  if (p.current) {
    for (const [type, label, href] of [["RUN", "course", "/record"], ["WORKOUT", "muscu", "/record/session"]] as const) {
      const mine = training.filter((a) => a.type === type), last = mine.reduce<string | null>((m, a) => { const k = dayKey(a.startedAt, p.tz); return !m || k > m ? k : m; }, null);
      const habit = mine.filter((a) => between(a, shiftDay(f.endKey, -56), f.endKey)).length >= 3; // pratiquée sur les 8 dernières semaines
      const gap = last ? days(last, f.endKey) : 0;
      if (habit && gap >= 8) notes.push({
        id: `gap-${type}`, tone: "warn", title: `Pas de ${label} depuis ${gap} jours`,
        body: type === "RUN" ? "Pour reprendre le fil, une sortie facile de 30 à 40 minutes suffit, sans chercher l'allure." : "Reprends à la dernière cible notée : une séance suffit pour relancer la progression.",
        action: { label: type === "RUN" ? "Enregistrer une sortie" : "Démarrer une séance", href },
      });
    }
  }

  // 2. Charge des 7 derniers jours par rapport à la forme de fond (rapport fatigue / fitness)
  const loadOf = (a: CoachAct) => a.load ?? estimateLoad(a);
  const hasLoad = training.some((a) => loadOf(a) > 0);
  const series = hasLoad ? fitnessSeries(training, p.now, p.tz, f.span + 84) : [];
  const end = series[series.length - 1], start = series.find((x) => x.key === shiftDay(f.startKey, -1));
  if (p.current && end && end.ctl >= 10) {
    const ratio = end.atl / end.ctl, pct = Math.round((ratio - 1) * 100);
    if (ratio >= 1.5) notes.push({ id: "acwr", tone: "bad", title: "Charge en forte hausse", body: `Ta fatigue (${fr(end.atl)}) dépasse ta forme de fond (${fr(end.ctl)}) de ${pct} %. Au-delà de +50 %, le risque de blessure grimpe : allège les 3 ou 4 prochains jours.` });
    else if (ratio >= 1.3) notes.push({ id: "acwr", tone: "warn", title: "Charge en hausse rapide", body: `Ta fatigue dépasse ta forme de fond de ${pct} %. Garde ce niveau la semaine prochaine plutôt que d'en rajouter.` });
  }

  // 3. Forme de fond (fitness) entre le début et la fin de la période
  if (start && end && Math.max(start.ctl, end.ctl) >= 5) {
    const d = end.ctl - start.ctl, perWeek = d / p.weeks;
    if (d >= 3) notes.push({ id: "ctl", tone: perWeek > 8 ? "warn" : "good", title: "Forme de fond en hausse", body: `Fitness ${fr(start.ctl)} → ${fr(end.ctl)} sur la période. ${perWeek > 8 ? `Le rythme est rapide (+${fr(perWeek)} par semaine) : prévois une semaine plus légère bientôt.` : "Tu construis : continue sur ce tempo."}` });
    else if (d <= -3) notes.push({ id: "ctl", tone: "warn", title: "Forme de fond en baisse", body: `Fitness ${fr(start.ctl)} → ${fr(end.ctl)} sur la période. Normal après une coupure ou une semaine de récup ; sinon, remets du volume progressivement.` });
  }

  // 4. Régularité : séances par semaine terminée, comparée à ta cible
  if (f.fullWeeks >= 2) {
    const perWeek = sessionsPerWeek(cur, p)!;
    const empty = Array.from({ length: f.fullWeeks }, (_, i) => shiftDay(f.startKey, 7 * i)).filter((mon) => !cur.some((a) => between(a, mon, shiftDay(mon, 6)))).length;
    const blank = empty ? ` ${plural(empty, "semaine")} sans aucune séance.` : "";
    if (perWeek < TARGET_ALL[0] - 1) notes.push({ id: "freq", tone: "warn", title: `${fr(perWeek, 1)} séance${perWeek >= 2 ? "s" : ""} par semaine`, body: `Ta cible est de ${TARGET_ALL[0]} à ${TARGET_ALL[1]} (2 à 3 courses + 2 à 3 muscu).${blank} La régularité compte plus que l'intensité : vise d'abord 2 séances par discipline.` });
    else if (perWeek >= TARGET_ALL[0]) notes.push({ id: "freq", tone: "good", title: `Régulier : ${fr(perWeek, 1)} séances par semaine`, body: `Dans ta cible de ${TARGET_ALL[0]} à ${TARGET_ALL[1]} séances.${blank}` });
    else notes.push({ id: "freq", tone: "info", title: `${fr(perWeek, 1)} séances par semaine`, body: `Presque dans ta cible de ${TARGET_ALL[0]} à ${TARGET_ALL[1]} : une séance de plus par semaine et c'est bon.${blank}` });
  }

  // 5. Volume d'entraînement par rapport à la période précédente, à durée égale
  const pct = prev.length >= 2 ? rateChange(time(cur), f.span, time(prev), f.prevSpan) : null;
  if (pct != null && cur.length) {
    const vs = `${hours(time(cur))} contre ${hours(time(prev))} sur les ${p.weeks} semaines précédentes${f.span < f.prevSpan ? ", à durée égale" : ""}`;
    if (pct >= 15) notes.push({ id: "volume", tone: "good", title: `+${pct} % de temps d'entraînement`, body: `${vs}.` });
    else if (pct <= -25) notes.push({ id: "volume", tone: "warn", title: `${pct} % de temps d'entraînement`, body: `${vs}. Si c'est voulu (récupération, fatigue), parfait ; sinon, reprends par une séance de plus par semaine.` });
    else notes.push({ id: "volume", tone: "info", title: "Volume stable", body: `${vs} (${pct > 0 ? "+" : ""}${pct} %).` });
  }

  return rankNotes([...notes, ...planNotes(plans)]);
}

// ───────── Onglet « Course à pied » ─────────

export function runNotes(input: { acts: CoachAct[]; period: CoachPeriod; goal?: RunGoal | null; plans?: PlanAdherence[] }): CoachNote[] {
  const { acts, period: p, goal = null, plans = [] } = input;
  const f = frame(p), notes: CoachNote[] = [];
  const runs = acts.filter((a) => a.type === "RUN" && !isCommute({ ...a }) && +a.startedAt <= +p.now).sort((a, b) => +a.startedAt - +b.startedAt);
  const between = (a: CoachAct, from: string, to: string) => { const k = dayKey(a.startedAt, p.tz); return k >= from && k <= to; };
  const cur = runs.filter((a) => between(a, f.startKey, f.endKey)), prev = runs.filter((a) => between(a, f.prevStart, f.prevEnd));
  const km = (l: CoachAct[]) => l.reduce((s, a) => s + a.distanceM, 0) / 1000;
  const paceOf = (l: CoachAct[]) => l.reduce((s, a) => s + a.movingTimeS, 0) / km(l); // s/km
  if (!cur.length) return rankNotes(planNotes(plans));

  // 1. Hausse brutale du volume : dernière semaine terminée contre la moyenne des 3 précédentes (historique chargé au-delà de la période)
  {
    const wk = (mon: string) => km(runs.filter((a) => between(a, mon, shiftDay(mon, 6))));
    const last = wk(f.lastFullMon), before = [1, 2, 3].map((i) => wk(shiftDay(f.lastFullMon, -7 * i))), avg = before.reduce((s, v) => s + v, 0) / 3;
    if (avg >= 5 && last > avg * 1.3) notes.push({ id: "ramp", tone: "warn", title: `+${Math.round((last / avg - 1) * 100)} % de kilomètres en une semaine`, body: `${fr(last, 1)} km la semaine dernière contre ${fr(avg, 1)} km en moyenne les 3 précédentes. Garde ce volume une semaine avant de remonter : les tendons s'adaptent moins vite que le cardio.` });
  }

  // 2. Allure : premières sorties de la période contre les dernières (sorties de 3 km et plus)
  const timed = cur.filter((a) => a.distanceM >= 3000 && a.movingTimeS > 0);
  if (timed.length >= 4) {
    const half = Math.floor(timed.length / 2), a = paceOf(timed.slice(0, half)), b = paceOf(timed.slice(timed.length - half)), gain = a - b;
    if (gain >= 5) notes.push({ id: "pace", tone: "good", title: `${Math.round(gain)} s/km plus rapide`, body: `Allure moyenne passée de ${fmtPaceS(a)} à ${fmtPaceS(b)} /km entre le début et la fin de la période.` });
    else if (gain <= -10) notes.push({ id: "pace", tone: "warn", title: "Allure en baisse", body: `De ${fmtPaceS(a)} à ${fmtPaceS(b)} /km entre le début et la fin de la période. Normal si tu as couru plus long ou plus en endurance ; sinon, c'est souvent un signe de fatigue.` });
  }

  // 3. Fréquence : sorties par semaine terminée
  if (f.fullWeeks >= 2) {
    const perWeek = sessionsPerWeek(cur, p)!;
    if (perWeek < TARGET_RUNS[0] - 0.3) notes.push({ id: "freq", tone: "warn", title: `${fr(perWeek, 1)} sortie${perWeek >= 2 ? "s" : ""} par semaine`, body: `Ta cible est de ${TARGET_RUNS[0]} à ${TARGET_RUNS[1]}. Deux sorties par semaine suffisent pour progresser ; une seule ne fait qu'entretenir.` });
    else if (perWeek <= TARGET_RUNS[1] + 0.5) notes.push({ id: "freq", tone: "good", title: `${fr(perWeek, 1)} sorties par semaine`, body: `Dans ta cible de ${TARGET_RUNS[0]} à ${TARGET_RUNS[1]}.` });
  }

  // 4. Objectif : prédiction et sortie longue
  if (goal?.targetTimeS && goal.predictedTimeS) {
    const d = goal.predictedTimeS - goal.targetTimeS, clock = fmtClock;
    notes.push(d <= 0
      ? { id: "goal", tone: "good", title: "Objectif à ta portée", body: `Prédiction ${clock(goal.predictedTimeS)} pour « ${goal.title} » (objectif ${clock(goal.targetTimeS)}).` }
      : { id: "goal", tone: d > goal.targetTimeS * 0.05 ? "warn" : "info", title: `${clock(d)} à gagner`, body: `Prédiction ${clock(goal.predictedTimeS)} pour « ${goal.title} » (objectif ${clock(goal.targetTimeS)}). Les séances de VMA et le seuil sont ce qui fera bouger ce chrono.`, action: { label: "Voir l'objectif", href: "/goals" } });
  }
  const longest = Math.max(...cur.map((a) => a.distanceM));
  if (goal?.distanceM && goal.distanceM >= 10000 && longest < goal.distanceM * 0.8) {
    notes.push({ id: "long", tone: "info", title: "Allonge ta sortie longue", body: `Ta plus longue sortie fait ${fr(longest / 1000, 1)} km. Pour « ${goal.title} », monte d'environ 1 km par semaine jusqu'à ${fr(goal.distanceM / 1000, 1)} km.` });
  }

  // 5. Kilomètres par rapport à la période précédente, à durée égale
  const pct = prev.length >= 2 ? rateChange(km(cur), f.span, km(prev), f.prevSpan) : null;
  if (pct != null) {
    const vs = `${fr(km(cur), 1)} km contre ${fr(km(prev), 1)} km sur les ${p.weeks} semaines précédentes${f.span < f.prevSpan ? ", à durée égale" : ""}`;
    if (pct >= 15) notes.push({ id: "volume", tone: "good", title: `+${pct} % de kilomètres`, body: `${vs}.` });
    else if (pct <= -25) notes.push({ id: "volume", tone: "warn", title: `${pct} % de kilomètres`, body: `${vs}.` });
    else notes.push({ id: "volume", tone: "info", title: "Kilométrage stable", body: `${vs} (${pct > 0 ? "+" : ""}${pct} %).` });
  }

  return rankNotes([...notes, ...planNotes(plans.filter((x) => x.sport === "RUN"))]);
}

// ───────── Onglet « Musculation » ─────────

/** `perWeek` : séances par semaine de la page (`sessionsPerWeek`, comme la tuile) ; à défaut, celle de l'analyse de muscu. */
export function strengthNotes(input: { data: StrengthAnalysis; period: CoachPeriod; plans?: PlanAdherence[]; perWeek?: number | null }): CoachNote[] {
  const { data, period: p, plans = [] } = input;
  if (data.empty) return rankNotes(planNotes(plans.filter((x) => x.sport === "WORKOUT")));
  const f = frame(p), notes: CoachNote[] = [];

  // 1. Progression Lafay par exercice
  const ex = data.exercises, stuck = ex.filter((e) => e.status === "stall2"), capped = ex.filter((e) => e.status === "evolve"), up = ex.filter((e) => e.status === "progress");
  const named = (e: (typeof ex)[number]) => `${e.name}${e.variant && !e.name.toUpperCase().startsWith(e.variant) ? ` (${e.variant})` : ""}`;
  if (stuck.length) notes.push({
    id: "stuck", tone: "warn", title: `${plural(stuck.length, "exercice")} bloqué${stuck.length > 1 ? "s" : ""}`,
    body: `${stuck.slice(0, 2).map((e) => `${named(e)} : ${e.hint}`).join(" ; ")}. Deux séances sans progrès, c'est le signal Lafay pour changer de niveau.`,
  });
  if (capped.length) notes.push({ id: "cap", tone: "info", title: "Plafond atteint", body: `${capped.slice(0, 2).map((e) => `${named(e)} : ${e.hint}`).join(" ; ")}.` });
  if (up.length && ex.length) notes.push({ id: "progress", tone: "good", title: `${up.length} exercice${up.length > 1 ? "s" : ""} sur ${ex.length} en progrès`, body: up.length === ex.length ? "Tous tes exercices progressent : le total de répétitions monte séance après séance." : `${up.slice(0, 3).map(named).join(", ")} : le total de répétitions monte séance après séance.` });

  // 2. Fréquence par rapport aux 2 à 3 séances par semaine
  if (f.fullWeeks >= 2) {
    const per = input.perWeek ?? data.regularity.perWeek;
    if (per < TARGET_LIFTS[0] - 0.3) notes.push({ id: "freq", tone: "warn", title: `${fr(per, 1)} séance${per >= 2 ? "s" : ""} par semaine`, body: `Ta cible est de ${TARGET_LIFTS[0]} à ${TARGET_LIFTS[1]}. En dessous de 2 séances par semaine, le « +1 rep par séance » a du mal à tenir.` });
    else if (per > TARGET_LIFTS[1] + 0.5) notes.push({ id: "freq", tone: "info", title: `${fr(per, 1)} séances par semaine`, body: "Au-delà de 3, garde au moins un jour de repos entre deux séances qui travaillent les mêmes muscles." });
    else notes.push({ id: "freq", tone: "good", title: "Rythme respecté", body: `${fr(per, 1)} séances par semaine, dans ta cible de ${TARGET_LIFTS[0]} à ${TARGET_LIFTS[1]}.` });
  }

  // 3. Équilibre haut / bas du corps (alternance half-body)
  const u = data.regularity.upperPct;
  if (u != null && (u >= 70 || u <= 30)) {
    const weak = u >= 70 ? "bas" : "haut";
    notes.push({ id: "balance", tone: "warn", title: `Le ${weak} du corps est en retrait`, body: `${u} % de tes séries travaillent le haut du corps. En half-body, alterne haut et bas à chaque séance pour garder l'équilibre.` });
  }

  // 4. Répétitions par rapport à la période précédente, à durée égale
  const prev = data.prev, pct = prev && prev.sessions >= 2 ? rateChange(data.summary.reps, f.span, prev.reps, f.prevSpan) : null;
  if (pct != null) {
    const vs = `${fr(data.summary.reps)} répétitions contre ${fr(prev!.reps)} sur les ${p.weeks} semaines précédentes${f.span < f.prevSpan ? ", à durée égale" : ""}`;
    if (pct >= 15) notes.push({ id: "volume", tone: "good", title: `+${pct} % de répétitions`, body: `${vs}.` });
    else if (pct <= -25) notes.push({ id: "volume", tone: "warn", title: `${pct} % de répétitions`, body: `${vs}.` });
  }

  return rankNotes([...notes, ...planNotes(plans.filter((x) => x.sport === "WORKOUT"))]);
}
