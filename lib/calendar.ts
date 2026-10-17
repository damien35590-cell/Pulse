import { shiftDay } from "@/lib/dates";

/** Clé YYYY-MM-DD d'un jour, sans fuseau (calendrier pur). */
const key = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
/** Lundi = 0 … dimanche = 6. */
const dow = (k: string) => (new Date(`${k}T00:00:00Z`).getUTCDay() + 6) % 7;

/** Grille d'un mois (month = 1..12) : du lundi précédant le 1er au dimanche suivant le dernier jour. */
export function monthGrid(year: number, month: number) {
  const first = key(year, month, 1), last = key(year, month + 1, 0);
  const start = shiftDay(first, -dow(first)), end = shiftDay(last, 6 - dow(last));
  const days: string[] = [];
  for (let k = start; k <= end; k = shiftDay(k, 1)) days.push(k);
  return { first, last, start, end, days, weeks: days.length / 7 };
}

/** Les 7 jours (lundi → dimanche) de la semaine contenant `k`. */
export function weekOf(k: string) {
  const mon = shiftDay(k, -dow(k));
  return Array.from({ length: 7 }, (_, i) => shiftDay(mon, i));
}

/** Premier jour du mois précédent (n = -1) ou suivant (n = 1) d'un mois donné. */
export const shiftMonth = (year: number, month: number, n: number) => {
  const d = new Date(Date.UTC(year, month - 1 + n, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
};
