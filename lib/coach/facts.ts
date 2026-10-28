/**
 * Faits envoyés au coach IA : chiffres déjà calculés par Pulse (analyses + « Le mot du coach »), jamais de données brutes.
 * L'IA raisonne et rédige ; elle ne calcule rien. Un seul objet JSON compact par onglet (Tous, Course, Muscu).
 */
import { prisma } from "../prisma";
import { dayKey } from "../dates";
import { isCommute } from "../routes/estimate";
import { getOverview } from "../analytics/overview";
import { getStrengthAnalysis } from "../analytics/strength";
import { frame, runNotes, strengthNotes, type CoachNote } from "../analytics/coach-notes";
import { getPlanAdherence, getRunGoal } from "../data/coach";
import { restDrop, setsOf } from "../workout/hr";
import type { Period } from "../analysis/period";

export type CoachScope = "all" | "RUN" | "WORKOUT";
const r1 = (n: number) => Math.round(n * 10) / 10;
const pace = (timeS: number, m: number) => (m > 0 ? `${Math.floor(timeS / (m / 1000) / 60)}:${String(Math.round((timeS / (m / 1000)) % 60)).padStart(2, "0")}` : null);
/** Séances de muscu de la période avec FC (ceinture cardio) : moyenne des FC moyennes, FC max atteinte, baisse moyenne pendant les repos. Null sans mesure. */
async function strengthHeart(userId: string, period: Period, tz: string) {
  const acts = (await prisma.activity.findMany({
    where: { userId, type: "WORKOUT", avgHr: { gt: 0 }, startedAt: { gte: new Date(Date.parse(period.startKey + "T00:00:00Z") - 864e5), lte: period.now } },
    select: { startedAt: true, avgHr: true, maxHr: true, exercises: { select: { setsDetail: true } } },
  })).filter((a) => dayKey(a.startedAt, tz) >= period.startKey);
  if (!acts.length) return null;
  const drop = restDrop(acts.flatMap((a) => setsOf(a.exercises.map((e) => e.setsDetail))));
  return {
    seancesAvecFc: acts.length,
    fcMoyenneDesSeances: Math.round(acts.reduce((s, a) => s + a.avgHr!, 0) / acts.length),
    fcMaxAtteinte: Math.max(...acts.map((a) => a.maxHr ?? 0)),
    baisseMoyenneFcPendantRepos: drop ? { bpm: drop.bpm, series: drop.sets } : null,
  };
}
const notesOf = (l: CoachNote[]) => l.map((n) => `[${n.tone}] ${n.title} — ${n.body}`);

export async function getCoachFacts(userId: string, scope: CoachScope, period: Period, tz: string) {
  const { weeks, now, current } = period, todayKey = dayKey(new Date(), tz);
  const coachPeriod = { weeks, tz, now, current };
  const base = {
    aujourdhui: todayKey,
    periode: { semaines: weeks, du: period.startKey, au: period.endKey, enCours: current },
  };

  if (scope === "WORKOUT") {
    const [s, plans, fc] = await Promise.all([getStrengthAnalysis(userId, tz, weeks, now), getPlanAdherence(userId, period.startKey, period.endKey, todayKey, "WORKOUT"), strengthHeart(userId, period, tz)]);
    return {
      ...base, onglet: "musculation",
      resume: { seances: s.summary.sessions, series: s.summary.sets, repetitions: s.summary.reps, tonnageKg: s.summary.tonnage },
      periodePrecedente: s.prev ? { seances: s.prev.sessions, repetitions: s.prev.reps } : null,
      regularite: { seancesParSemaine: r1(s.regularity.perWeek), cible: "2 à 3", pctSeriesHautDuCorps: s.regularity.upperPct },
      exercices: s.exercises.slice(0, 12).map((e) => ({
        nom: e.name, variante: e.variant, niveau: e.level, statut: { progress: "progresse", stall1: "1 séance sans progrès", stall2: "bloqué (2 séances ou plus)", evolve: "plafond atteint" }[e.status],
        seances: e.sessions, totalRepsDernieresSeances: e.repsPerSession.slice(-6),
        ...(e.hardPerSession.some((n) => n > 0) ? { seriesMarqueesDuresDernieresSeances: e.hardPerSession.slice(-6) } : {}), derniereSeance: e.lastDay, conseilPulse: e.hint,
      })),
      programmes: plans,
      ...(fc ? { frequenceCardiaque: fc } : {}),
      constatsPulse: notesOf(strengthNotes({ data: s, period: coachPeriod, plans })),
    };
  }

  if (scope === "RUN") {
    const f = frame(coachPeriod);
    const [acts, goal, plans] = await Promise.all([
      prisma.activity.findMany({
        where: { userId, type: "RUN", startedAt: { gte: new Date(Date.parse(f.prevStart + "T00:00:00Z") - 864e5), lte: now } }, orderBy: { startedAt: "asc" },
        select: { type: true, title: true, source: true, dedupeKey: true, load: true, startedAt: true, distanceM: true, movingTimeS: true, avgHr: true, rpe: true, srpe: true },
      }),
      getRunGoal(userId), getPlanAdherence(userId, period.startKey, period.endKey, todayKey, "RUN"),
    ]);
    const runs = acts.filter((a) => !isCommute({ ...a })), inCur = (a: (typeof runs)[number]) => dayKey(a.startedAt, tz) >= f.startKey;
    const cur = runs.filter(inCur), prev = runs.filter((a) => !inCur(a) && dayKey(a.startedAt, tz) >= f.prevStart);
    const km = (l: typeof runs) => r1(l.reduce((s, a) => s + a.distanceM, 0) / 1000);
    const weekly = Array.from({ length: weeks }, (_, i) => {
      const mon = new Date(Date.parse(period.startKey + "T00:00:00Z") + i * 7 * 864e5).toISOString().slice(0, 10), sun = new Date(Date.parse(mon) + 6 * 864e5).toISOString().slice(0, 10);
      const l = cur.filter((a) => { const k = dayKey(a.startedAt, tz); return k >= mon && k <= sun; });
      return { semaineDu: mon, sorties: l.length, km: km(l) };
    });
    return {
      ...base, onglet: "course à pied",
      resume: { sorties: cur.length, km: km(cur), tempsMin: Math.round(cur.reduce((s, a) => s + a.movingTimeS, 0) / 60), allureMoyenne: pace(cur.reduce((s, a) => s + a.movingTimeS, 0), cur.reduce((s, a) => s + a.distanceM, 0)) },
      periodePrecedente: { sorties: prev.length, km: km(prev) },
      parSemaine: weekly,
      dernieresSorties: cur.slice(-8).map((a) => ({ jour: dayKey(a.startedAt, tz), km: r1(a.distanceM / 1000), allure: pace(a.movingTimeS, a.distanceM), fcMoy: a.avgHr ?? null, effortRessenti: a.rpe ?? null, chargeRessentie: a.srpe ?? null })),
      objectif: goal ? { titre: goal.title, distanceKm: goal.distanceM ? r1(goal.distanceM / 1000) : null, tempsViseS: goal.targetTimeS, tempsPreditS: goal.predictedTimeS } : null,
      programmes: plans,
      cible: "2 à 3 sorties par semaine",
      constatsPulse: notesOf(runNotes({ acts, period: coachPeriod, goal, plans })),
    };
  }

  const plans = await getPlanAdherence(userId, period.startKey, period.endKey, todayKey);
  const o = await getOverview(userId, tz, weeks, now, { current, plans });
  // Charge ressentie (sRPE = RPE × minutes) par semaine, seulement sur les séances notées, hors vélotaf et marche.
  const rated = (await prisma.activity.findMany({
    where: { userId, srpe: { not: null }, startedAt: { gte: new Date(Date.parse(period.startKey + "T00:00:00Z") - 864e5), lte: now } },
    select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true, srpe: true },
  })).filter((a) => !isCommute(a));
  const srpeWeeks = o.weekly.map((w) => {
    const end = new Date(Date.parse(w.weekStart) + 6 * 864e5).toISOString().slice(0, 10);
    const l = rated.filter((a) => { const k = dayKey(a.startedAt, tz); return k >= w.weekStart && k <= end; });
    return { semaineDu: w.weekStart, seancesNotees: l.length, chargeRessentie: l.reduce((s, a) => s + (a.srpe ?? 0), 0) };
  });
  return {
    ...base, onglet: "tous les sports",
    resume: { seances: o.summary.sessions, tempsMin: Math.round(o.summary.timeS / 60), charge: o.summary.load, joursActifs: o.summary.activeDays },
    repartition: o.split.map((s) => ({ sport: s.group, seances: s.sessions, pctTemps: s.timePct })),
    heuresParSemaine: o.weekly.map((w) => ({ semaineDu: w.weekStart, heures: r1(Object.values(w.hours).reduce((a, b) => a + b, 0)) })),
    chargeRessentieParSemaine: srpeWeeks,
    forme: o.form ? { fitness: Math.round(o.form.ctl), fatigue: Math.round(o.form.atl), fraicheur: Math.round(o.form.form), zone: o.form.zone.label } : null,
    regularite: { seancesParSemaine: r1(o.regularity.perWeek), semainesActivesDaffilee: o.regularity.activeStreak, cible: "4 à 6 (2-3 courses + 2-3 muscu)" },
    programmes: plans,
    constatsPulse: notesOf(o.notes),
    phrasesParSport: o.insights,
  };
}
export type CoachFacts = Awaited<ReturnType<typeof getCoachFacts>>;
