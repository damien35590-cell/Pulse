const rad = Math.PI / 180;

/** Lever / coucher du soleil (formules NOAA simplifiées, précision ~ 1-2 min). */
export function sunTimes(date: Date, lat: number, lng: number) {
  const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const doy = Math.floor((base - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5);
  const g = (2 * Math.PI / 365) * (doy - 1);
  const eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const c = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
  if (c < -1 || c > 1) return null; // nuit/jour polaire
  const ha = Math.acos(c) / rad;
  return { sunrise: new Date(base + (720 - 4 * (lng + ha) - eqt) * 60000), sunset: new Date(base + (720 - 4 * (lng - ha) - eqt) * 60000) };
}
