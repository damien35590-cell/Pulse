/**
 * Bilan d'une course terminée : objectif, allure, percentile, comparaison avec la course précédente.
 * Fonction pure (testée dans tools/test-race-bilan.ts) ; le ton reste positif, jamais culpabilisant.
 */

export type BilanRace = {
  sport: string; targetDistance: number | null; goalTimeS: number | null; resultTimeS: number | null;
  rankOverall: number | null; participants: number | null;
};
export type BilanPrevious = { name: string; date: Date | string; sport: string; targetDistance: number | null; resultTimeS: number | null };
export type Bilan = {
  goal: { text: string; beaten: boolean } | null;
  pace: { actual: string; target: string | null; text: string } | null;
  percentile: { top: number; text: string } | null;
  versus: { name: string; text: string } | null;
  beaten: boolean;
};

/** 72 → "1 min 12 s", 48 → "48 s", 3725 → "1 h 02 min 05 s". */
export function fmtDelta(s: number) {
  const t = Math.round(Math.abs(s)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60;
  if (h) return `${h} h ${String(m).padStart(2, "0")} min ${String(r).padStart(2, "0")} s`;
  if (m) return r ? `${m} min ${String(r).padStart(2, "0")} s` : `${m} min`;
  return `${r} s`;
}

const pad = (n: number) => String(n).padStart(2, "0");
const perKm = (s: number) => { const t = Math.round(s); return `${Math.floor(t / 60)}'${pad(t % 60)}/km`; };
const kmh = (km: number, s: number) => `${(km / (s / 3600)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km/h`;
const speed = (sport: string, km: number, s: number) => (sport === "RIDE" ? kmh(km, s) : perKm(s / km));

/** Course de distance proche (±15 %) la plus récente avec un résultat, parmi celles déjà passées. */
export function pickPrevious<P extends BilanPrevious>(race: Pick<BilanRace, "sport" | "targetDistance">, others: P[]): P | null {
  const km = race.targetDistance;
  if (!km) return null;
  return others
    .filter((o) => o.sport === race.sport && o.resultTimeS && o.targetDistance && Math.abs(o.targetDistance - km) / km <= 0.15)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))[0] ?? null;
}

export function raceBilan(race: BilanRace, previous: BilanPrevious | null): Bilan | null {
  const t = race.resultTimeS;
  if (!t) return null;
  const km = race.targetDistance && race.targetDistance > 0 ? race.targetDistance : null;

  let goal: Bilan["goal"] = null;
  if (race.goalTimeS) {
    const d = race.goalTimeS - t;
    goal = d > 0 ? { text: `Objectif battu de ${fmtDelta(d)} 🎉`, beaten: true }
      : d === 0 ? { text: "Objectif atteint à la seconde près 🎯", beaten: true }
      : { text: `À ${fmtDelta(d)} de l’objectif, la prochaine sera la bonne 💪`, beaten: false };
  }

  let pace: Bilan["pace"] = null;
  if (km) {
    const actual = speed(race.sport, km, t), target = race.goalTimeS ? speed(race.sport, km, race.goalTimeS) : null;
    pace = { actual, target, text: target ? `Allure réelle ${actual} · cible ${target}` : `Allure réelle ${actual}` };
  }

  let percentile: Bilan["percentile"] = null;
  if (race.rankOverall && race.participants && race.rankOverall <= race.participants) {
    const top = Math.max(1, Math.ceil((race.rankOverall / race.participants) * 100));
    percentile = { top, text: race.rankOverall === 1 ? "Victoire au général 🏆" : `Top ${top} %` };
  }

  let versus: Bilan["versus"] = null;
  if (previous?.resultTimeS && previous.targetDistance && km) {
    const sameDistance = Math.abs(previous.targetDistance - km) / km <= 0.03;
    // Distances quasi identiques : on compare les temps ; sinon les allures (l'écart de temps n'aurait pas de sens).
    const diff = sameDistance ? previous.resultTimeS - t : (previous.resultTimeS / previous.targetDistance - t / km);
    const unit = sameDistance ? fmtDelta(diff) : `${fmtDelta(diff)}/km`;
    const text = Math.round(diff) === 0 ? `Même chrono qu’à ${previous.name}`
      : diff > 0 ? `${unit} plus rapide qu’à ${previous.name}`
      : `${unit} de plus qu’à ${previous.name}, la forme reviendra`;
    versus = { name: previous.name, text };
  }

  return { goal, pace, percentile, versus, beaten: !!goal?.beaten };
}
