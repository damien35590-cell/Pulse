export const ZONES = [
  { id: 1, label: "Z1", name: "Récupération", color: "#8A8A95" },
  { id: 2, label: "Z2", name: "Endurance", color: "#3B82F6" },
  { id: 3, label: "Z3", name: "Tempo", color: "#22C55E" },
  { id: 4, label: "Z4", name: "Seuil", color: "#EAB308" },
  { id: 5, label: "Z5", name: "VO2max", color: "#EF4444" },
  { id: 6, label: "Z6", name: "Anaérobie", color: "#8B5CF6" },
] as const;

/** Bornes hautes de Z1 à Z5, en % (Z6 = au-delà). Puissance : modèle de Coggan, % de la FTP. Cardio : % de la FC max. */
export const POWER_PCT = [55, 75, 90, 105, 120];
export const HR_PCT = [60, 70, 80, 90, 95];
export const bounds = (ref: number, pct: number[]) => pct.map((p) => Math.round((ref * p) / 100));

/** Répartit chaque seconde dans sa zone. Pour le cardio, les secondes sans mesure (0) sont ignorées. */
export function timeInZones(series: number[], upper: number[], skipZero = false): number[] {
  const out = new Array<number>(ZONES.length).fill(0);
  for (const v of series) {
    if (skipZero && v <= 0) continue;
    let z = 0;
    while (z < upper.length && v > upper[z]) z++;
    out[z]++;
  }
  return out;
}
