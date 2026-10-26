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

/** « 2026-10-12 » → « 12 oct. » (clé de jour calendaire, sans décalage de fuseau). */
export const fmtDayKey = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

/** Date d'une activité en français : « Mardi 20 octobre à 12:36 » (jamais de CSS capitalize). Majuscule seulement si la date ouvre la phrase ; après un préfixe (`prefixed`) : « Musculation · mardi 20 octobre… ». */
export function fmtWhen(d: Date, tz: string, o: { short?: boolean; year?: boolean; prefixed?: boolean } = {}) {
  const s = o.short ? "short" : "long";
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: s, day: "numeric", month: s, ...(o.year ? { year: "numeric" } : {}), timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(d);
  return `${o.prefixed ? day : day.charAt(0).toUpperCase() + day.slice(1)} à ${time}`;
}

/** Date courte d'une activité : « mar. 13 oct. · 12:36 » (année ajoutée si ce n'est pas l'année en cours). */
export function fmtWhenShort(d: Date, tz: string, now = new Date()) {
  const year = (x: Date) => new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone: tz }).format(x);
  const day = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", ...(year(d) !== year(now) ? { year: "numeric" } : {}), timeZone: tz }).format(d);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(d);
  return `${day} · ${time}`;
}

/** Temps écoulé : « à l’instant », « il y a 12 min », « il y a 2 h », « il y a 3 j ». */
export function fmtAgo(iso: string, now = new Date()) {
  const min = Math.max(0, Math.floor((+now - +new Date(iso)) / 60_000));
  if (min < 1) return "à l’instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.floor(min / 60)} h`;
  return `il y a ${Math.floor(min / (24 * 60))} j`;
}

/** Ordinal français : 1re / 1er, puis 2e, 14e… (jamais « ème »). `gender` : « f » par défaut (une sortie, une séance), « m » pour 1er. */
export const ordinalFr = (n: number, gender: "m" | "f" = "f") => (n === 1 ? (gender === "m" ? "1er" : "1re") : `${n}e`);
