/** `missing` : aucune donnée pour cet axe (il n'est pas tracé sur le radar) ; `note` : phrase affichée à sa place. */
export type Axis = { axis: string; value: number; raw: string; missing?: boolean; note?: string };

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
    { axis: "Endurance (Z2)", value: normalize(s.z2HoursPerWeek, 0, 5), raw: `${f1(s.z2HoursPerWeek)} h par semaine en Z2`, missing: !s.ftp, note: "Endurance : renseigne ta FTP pour mesurer le temps en Z2" },
    { axis: "Explosivité (Pmax)", value: normalize(s.best5s, 300, 1200), raw: s.best5s ? `${s.best5s} W sur 5 s` : "pas de données", missing: !s.best5s },
    { axis: "Puissance moyenne", value: rel, raw: s.avgPower ? `${Math.round(s.avgPower)} W en moyenne` : "pas de données", missing: !s.avgPower },
    { axis: "Cadence", value: normalize(s.avgCad, 60, 95), raw: s.avgCad ? `${Math.round(s.avgCad)} tr/min` : "pas de données", missing: !s.avgCad },
    { axis: "Résistance musculaire", value: normalize(ratio, 0.6, 0.95), raw: ratio ? `${Math.round(ratio * 100)} % (20 min / 5 min)` : "pas de données", missing: !ratio },
  ];
}

export type RunningStats = { longestKm: number; avgPace: number | null; dPlusPerWeek: number; activeDaysPerWeek: number; hrTargetShare: number | null };
export function runningRadar(s: RunningStats): Axis[] {
  return [
    { axis: "Endurance longue", value: normalize(s.longestKm, 3, 25), raw: `${f1(s.longestKm)} km, sortie la plus longue` },
    { axis: "Allure moyenne", value: normalize(s.avgPace, 7.5, 4.5), raw: s.avgPace ? pace(s.avgPace) : "pas de données", missing: !s.avgPace },
    { axis: "Capacité grimpeur (D+)", value: normalize(s.dPlusPerWeek, 0, 1500), raw: `${Math.round(s.dPlusPerWeek)} m de D+ par semaine` },
    { axis: "Régularité", value: normalize(s.activeDaysPerWeek, 0, 5), raw: `${f1(s.activeDaysPerWeek)} sorties par semaine` },
    { axis: "FC cible", value: normalize(s.hrTargetShare, 0, 0.7), raw: s.hrTargetShare != null ? `${Math.round(s.hrTargetShare * 100)} % du temps en Z2–Z3` : "pas de données cardio", missing: s.hrTargetShare == null, note: "FC : en attente de la ceinture cardio" },
  ];
}

export type HikingStats = { longestKm: number; maxDPlus: number; longestHours: number; climbRate: number | null; activeDaysPerWeek: number };
export function hikingRadar(s: HikingStats): Axis[] {
  return [
    { axis: "Distance", value: normalize(s.longestKm, 5, 25), raw: `${f1(s.longestKm)} km, rando la plus longue` },
    { axis: "Dénivelé", value: normalize(s.maxDPlus, 200, 1500), raw: `${Math.round(s.maxDPlus)} m de D+ en une sortie` },
    { axis: "Durée d'effort", value: normalize(s.longestHours, 1, 8), raw: `${f1(s.longestHours)} h, sortie la plus longue` },
    { axis: "Vitesse de montée", value: normalize(s.climbRate, 100, 500), raw: s.climbRate != null ? `${Math.round(s.climbRate)} m de D+ par heure` : "pas de dénivelé", missing: s.climbRate == null },
    { axis: "Régularité", value: normalize(s.activeDaysPerWeek, 0, 2), raw: `${f1(s.activeDaysPerWeek)} sorties par semaine` },
  ];
}

export type WorkoutStats = { sessionsPerWeek: number; tonnagePerWeek: number; avgLoad: number | null; bodyKg: number; groupsWorked: number; groupsTotal: number; setsPerSession: number | null };
export function workoutRadar(s: WorkoutStats): Axis[] {
  const rel = s.avgLoad != null ? s.avgLoad / s.bodyKg : null;
  return [
    { axis: "Régularité", value: normalize(s.sessionsPerWeek, 0, 4), raw: `${f1(s.sessionsPerWeek)} séances par semaine` },
    { axis: "Volume", value: normalize(s.tonnagePerWeek, 0, 20000), raw: `${f1(s.tonnagePerWeek / 1000)} t soulevées par semaine` },
    { axis: "Intensité", value: normalize(rel, 0.2, 1), raw: s.avgLoad != null && rel != null ? `${Math.round(s.avgLoad)} kg en moyenne (${Math.round(rel * 100)} % du poids du corps)` : "pas de charges saisies", missing: s.avgLoad == null },
    { axis: "Polyvalence", value: normalize(s.groupsWorked, 0, s.groupsTotal), raw: `${s.groupsWorked} groupes musculaires sur ${s.groupsTotal}` },
    { axis: "Séries par séance", value: normalize(s.setsPerSession, 5, 25), raw: s.setsPerSession != null ? `${Math.round(s.setsPerSession)} séries en moyenne` : "pas d'exercices saisis", missing: s.setsPerSession == null },
  ];
}
