/** Toutes les dates « calendaires » sont calculées dans le fuseau de l'utilisateur. */
export const dayKey = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const shiftDay = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** Les 7 clés YYYY-MM-DD (lundi→dimanche) de la semaine courante (offset 0) ou décalée. */
export function weekKeys(now: Date, tz: string, offsetWeeks = 0) {
  const k = dayKey(now, tz);
  const [y, m, d] = k.split("-").map(Number);
  const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => shiftDay(k, -dow + i + offsetWeeks * 7));
}

export const localHour = (d: Date, tz: string) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(d)) % 24;
