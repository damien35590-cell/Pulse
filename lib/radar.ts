export type Axis = { axis: string; value: number; raw: string };

/** Ramène une valeur sur 0–100 entre lo et hi (lo > hi inverse l'échelle, pratique pour l'allure). Valeur absente = 0. */
export function normalize(v: number | null | undefined, lo: number, hi: number): number {
  if (v == null || !Number.isFinite(v)) return 0;
  return Math.round(Math.max(0, Math.min(1, (v - lo) / (hi - lo))) * 100);
}
const f1 = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
const pace = (p: number) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60) % 60).padStart(2, "0")} /km`;

export type CyclingStats = { z2HoursPerWeek: number; best5s: number | null; best5m: number | null; best20m: number | null; avgPower: number | null; avgCad: number | null; ftp: number | null };
export function cyclingRadar(s: CyclingStats): Axis[] {
  const ratio = s.best20m && s.best5m ? s.best20m / s.best5m : null;
  const rel = s.avgPower != null && s.ftp ? normalize(s.avgPower / s.ftp, 0.4, 0.8) : normalize(s.avgPower, 100, 250);
  return [
    { axis: "Endurance (Z2)", value: normalize(s.z2HoursPerWeek, 0, 5), raw: `${f1(s.z2HoursPerWeek)} h par semaine en Z2` },
    { axis: "Explosivité (Pmax)", value: normalize(s.best5s, 300, 1200), raw: s.best5s ? `${s.best5s} W sur 5 s` : "pas de données" },
    { axis: "Puissance moyenne", value: rel, raw: s.avgPower ? `${Math.round(s.avgPower)} W en moyenne` : "pas de données" },
    { axis: "Cadence", value: normalize(s.avgCad, 60, 95), raw: s.avgCad ? `${Math.round(s.avgCad)} tr/min` : "pas de données" },
    { axis: "Résistance musculaire", value: normalize(ratio, 0.6, 0.95), raw: ratio ? `${Math.round(ratio * 100)} % (20 min / 5 min)` : "pas de données" },
  ];
}

export type RunningStats = { longestKm: number; avgPace: number | null; dPlusPerWeek: number; activeDaysPerWeek: number; hrTargetShare: number | null };
export function runningRadar(s: RunningStats): Axis[] {
  return [
    { axis: "Endurance longue", value: normalize(s.longestKm, 3, 25), raw: `${f1(s.longestKm)} km, sortie la plus longue` },
    { axis: "Allure moyenne", value: normalize(s.avgPace, 7.5, 4.5), raw: s.avgPace ? pace(s.avgPace) : "pas de données" },
    { axis: "Capacité grimpeur (D+)", value: normalize(s.dPlusPerWeek, 0, 1500), raw: `${Math.round(s.dPlusPerWeek)} m de D+ par semaine` },
    { axis: "Régularité", value: normalize(s.activeDaysPerWeek, 0, 5), raw: `${f1(s.activeDaysPerWeek)} jours par semaine` },
    { axis: "FC cible", value: normalize(s.hrTargetShare, 0, 0.7), raw: s.hrTargetShare != null ? `${Math.round(s.hrTargetShare * 100)} % du temps en Z2–Z3` : "pas de données cardio" },
  ];
}
