export const fmtNum = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
export const fmtKm = (m: number) => fmtNum(m / 1000, 1);
export const fmtDuration = (s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
};

/** Allure en min/km (course, marche, rando) ou vitesse en km/h (vélo). */
export function fmtPace(distanceM: number, movingTimeS: number, type: string) {
  if (distanceM < 100 || movingTimeS <= 0) return null;
  if (type === "RIDE") return { value: fmtNum((distanceM / 1000) / (movingTimeS / 3600), 1), unit: "km/h", label: "Vitesse" };
  if (type === "SWIM") return { value: `${Math.floor(movingTimeS / (distanceM / 100) / 60)}:${String(Math.round((movingTimeS / (distanceM / 100)) % 60)).padStart(2, "0")}`, unit: "/100 m", label: "Allure" };
  const s = movingTimeS / (distanceM / 1000);
  return { value: `${Math.floor(s / 60)}:${String(Math.round(s % 60) % 60).padStart(2, "0")}`, unit: "/km", label: "Allure" };
}

export const fmtClock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = Math.round(s % 60);
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};
