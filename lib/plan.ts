export type PlanSport = "RUN" | "RIDE" | "HIKE" | "WORKOUT";
export type Session = { day: number; title: string; lines?: string[] };
export type PlanWeek = { w: number; volume: number; note: string; sessions: Session[] };
export type Plan = { sport: PlanSport; goalLabel: string; weeks: number; days: number; base: number | null; peak: number | null; list: PlanWeek[] };

/** [libellé, sortie longue visée (km), pic hebdo (km), dénivelé par km (rando)] */
export const PLAN_GOALS: Record<PlanSport, [string, number, number, number][]> = {
  RUN: [["5 km", 5, 26, 0], ["10 km", 10, 34, 0], ["Semi-marathon", 21.1, 44, 0]],
  RIDE: [["60 km", 60, 110, 0], ["100 km", 100, 170, 0], ["150 km", 150, 230, 0]],
  HIKE: [["15 km, 600 m D+", 15, 45, 40], ["25 km, 1 200 m D+", 25, 70, 48], ["1 000 m D+ en une journée", 18, 60, 55]],
  WORKOUT: [["Force", 0, 0, 0], ["Prise de masse", 0, 0, 0], ["Remise en forme", 0, 0, 0]],
};
const KINDS: Record<number, string[]> = { 2: ["quality", "long"], 3: ["easy", "quality", "long"], 4: ["easy", "quality", "easy", "long"], 5: ["easy", "quality", "easy", "easy", "long"] };
const DAYS: Record<number, number[]> = { 2: [1, 5], 3: [1, 3, 6], 4: [0, 2, 4, 6], 5: [0, 1, 3, 4, 6] };
const EX: Record<string, string[]> = {
  T1: ["Squat", "Développé couché", "Rowing barre", "Développé militaire", "Gainage 3 × 45 s"], T2: ["Soulevé de terre roumain", "Tractions ou tirage vertical", "Développé incliné haltères", "Fentes marchées", "Curl biceps"],
  T3: ["Presse à cuisses", "Pompes lestées ou dips", "Tirage horizontal", "Élévations latérales", "Crunch à la poulie"], H1: ["Développé couché", "Tirage vertical", "Développé militaire", "Rowing haltère", "Triceps poulie"],
  B1: ["Squat", "Soulevé de terre roumain", "Fentes bulgares", "Mollets debout", "Gainage 3 × 45 s"], H2: ["Développé incliné", "Tractions", "Élévations latérales", "Rowing poitrine appuyée", "Curl biceps"], B2: ["Presse à cuisses", "Hip thrust", "Leg curl", "Extension jambes", "Mollets assis"],
};
const TPL: Record<number, string[]> = { 2: ["T1", "T2"], 3: ["T1", "T2", "T3"], 4: ["H1", "B1", "H2", "B2"] };
const REPS = [["5 × 5", "3 × 8"], ["4 × 8", "3 × 12"], ["3 × 12", "2 × 15"]];

function volumes(v0: number, peak: number, n: number) {
  const o: number[] = []; let v = Math.min(v0, peak);
  for (let w = 1; w <= n; w++) {
    if (w % 4 === 0) o.push(v * 0.7);
    else if (w === n && n >= 6) o.push(peak * 0.6);
    else { v = Math.min(peak, v * 1.1 + (peak - v0) / (n * 2)); o.push(v); }
  }
  return o;
}

/** Programme à partir du volume réel des 4 dernières semaines : +10 % par semaine, 1 semaine sur 4 allégée. */
export function buildPlan(o: { sport: PlanSport; goalIdx: number; weeks: number; days: number; baseWeeklyKm: number }): Plan {
  const g = PLAN_GOALS[o.sport][o.goalIdx] ?? PLAN_GOALS[o.sport][0], list: PlanWeek[] = [];
  const c = Math.min(Math.max(o.days, 2), o.sport === "WORKOUT" ? 4 : 5);
  if (o.sport === "WORKOUT") {
    const t = TPL[c], pr = REPS[o.goalIdx] ?? REPS[0];
    for (let w = 1; w <= o.weeks; w++) {
      const light = w % 4 === 0;
      list.push({ w, volume: light ? 0.7 : 1 + (w - 1) * 0.03, note: light ? "Semaine allégée : une série de moins, charges à 85 %." : "Charge : +2,5 % ou +1 répétition sur chaque exercice principal.",
        sessions: t.map((k, i) => ({ day: DAYS[c][i], title: c === 4 ? (i % 2 ? "Bas du corps" : "Haut du corps") : `Full body ${"ABC"[i]}`, lines: EX[k].map((e, j) => (/\d ×/.test(e) ? e : `${e} : ${pr[j < 3 ? 0 : 1]}`)) })) });
    }
    return { sport: o.sport, goalLabel: g[0], weeks: o.weeks, days: c, base: null, peak: null, list };
  }
  const v0 = Math.max(o.sport === "RIDE" ? 20 : o.sport === "HIKE" ? 6 : 8, o.baseWeeklyKm), vs = volumes(v0, g[2], o.weeks), step = o.sport === "RIDE" ? 5 : 0.5, rd = (v: number) => Math.max(step, Math.round(v / step) * step), ks = KINDS[c];
  for (let w = 1; w <= o.weeks; w++) {
    const V = vs[w - 1], rest = ks.length - 2;
    list.push({ w, volume: V, note: w % 4 === 0 ? "Semaine de récupération : le corps assimile." : w === o.weeks && o.weeks >= 6 ? "Affûtage : moins de volume, même intensité." : "Progression d’environ 10 % du volume.",
      sessions: ks.map((k, i) => {
        const km = rd(V * (k === "long" ? 0.36 : k === "quality" ? 0.24 : 0.4 / rest)); let title: string;
        if (o.sport === "RUN") title = k === "easy" ? `Footing facile ${km} km, allure de conversation` : k === "quality" ? (w % 2 ? `Fractionné : ${4 + Math.floor(w / 2)} × 800 m, récupération 90 s` : `Tempo : 2 × ${8 + w} min à allure seuil`) : `Sortie longue ${km} km, allure confortable`;
        else if (o.sport === "RIDE") title = k === "easy" ? `Endurance ${km} km, cadence souple` : k === "quality" ? `Sweet spot : 3 × ${8 + w} min, ${km} km au total` : `Sortie longue ${km} km`;
        else title = k === "easy" ? `Marche active ${km} km` : k === "quality" ? `Côte : ${3 + Math.floor(w / 2)} × 15 min de montée` : `Grande sortie ${km} km, ${Math.round(km * g[3])} m D+, sac chargé`;
        return { day: DAYS[c][i], title };
      }) });
  }
  return { sport: o.sport, goalLabel: g[0], weeks: o.weeks, days: c, base: v0, peak: g[2], list };
}
