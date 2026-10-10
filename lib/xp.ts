type A = { distanceM: number; elevationGainM: number; movingTimeS: number; type: string };

export const xpOf = (a: A) => Math.round(a.distanceM / 100 + a.elevationGainM / 8 + (a.type === "WORKOUT" ? (a.movingTimeS / 60) * 1.5 : a.movingTimeS / 360));

export function level(total: number) {
  let n = 1, need = 340, x = total;
  while (x >= need) { x -= need; n++; need = 250 + (n + 1) * 90; }
  return { n, xp: x, need };
}
const RANKS = ["Recrue", "Régulier", "Coureur", "Endurant", "Grimpeur", "Élite", "Légende"];
export const rank = (n: number) => RANKS[Math.min(RANKS.length - 1, Math.floor((n - 1) / 4))];
