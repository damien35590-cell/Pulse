export const fmtNum = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
export const fmtKm = (m: number) => fmtNum(m / 1000, 1);
export const fmtDuration = (s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
};

/** Allure « m:ss » à partir de secondes par unité. On arrondit AVANT de découper : 299,6 s → 5:00 (et non 4:00). */
export const fmtPaceS = (sec: number) => {
  const r = Math.round(sec);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, "0")}`;
};

/** Allure en min/km (course, marche, rando) ou vitesse en km/h (vélo). */
export function fmtPace(distanceM: number, movingTimeS: number, type: string) {
  if (distanceM < 100 || movingTimeS <= 0) return null;
  if (type === "RIDE") return { value: fmtNum((distanceM / 1000) / (movingTimeS / 3600), 1), unit: "km/h", label: "Vitesse" };
  if (type === "SWIM") return { value: fmtPaceS(movingTimeS / (distanceM / 100)), unit: "/100 m", label: "Allure" };
  return { value: fmtPaceS(movingTimeS / (distanceM / 1000)), unit: "/km", label: "Allure" };
}

export const fmtClock = (sec: number) => {
  const s = Math.round(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; // arrondi d'abord : jamais « 0:60 »
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};
