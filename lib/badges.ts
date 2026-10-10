import { shiftDay } from "./dates";

export type BadgeStats = { count: number; totalKm: number; totalElevation: number; maxKm: number; maxRunKm: number; hours: number; bestStreakDays: number };
export type BadgeDef = { id: string; name: string; desc: string; icon: "foot" | "flag" | "mountain" | "flame" | "clock" | "route"; test: (s: BadgeStats) => boolean };

/** Badges calculés à la volée à partir de vos stats : rien à synchroniser, rien à semer en base. */
export const BADGES: BadgeDef[] = [
  { id: "first", name: "Premier pas", desc: "Votre première sortie est enregistrée.", icon: "foot", test: (s) => s.count >= 1 },
  { id: "run5", name: "Cinq bornes", desc: "5 km de course d’une traite.", icon: "flag", test: (s) => s.maxRunKm >= 5 },
  { id: "run10", name: "Dix bornes", desc: "10 km de course d’une traite.", icon: "flag", test: (s) => s.maxRunKm >= 10 },
  { id: "semi", name: "Semi", desc: "21,1 km d’une traite. Les jambes s’en souviennent.", icon: "flag", test: (s) => s.maxRunKm >= 21.0975 },
  { id: "km100", name: "Les 100", desc: "100 km cumulés.", icon: "route", test: (s) => s.totalKm >= 100 },
  { id: "km1000", name: "Le millier", desc: "1 000 km cumulés, tous sports confondus.", icon: "route", test: (s) => s.totalKm >= 1000 },
  { id: "everest", name: "Everest en pièces", desc: "8 849 m de dénivelé cumulé.", icon: "mountain", test: (s) => s.totalElevation >= 8849 },
  { id: "long", name: "Grand large", desc: "Une sortie de plus de 50 km.", icon: "route", test: (s) => s.maxKm >= 50 },
  { id: "streak7", name: "Sept jours", desc: "7 jours de suite avec une sortie.", icon: "flame", test: (s) => s.bestStreakDays >= 7 },
  { id: "hours100", name: "Cent heures", desc: "100 heures en mouvement.", icon: "clock", test: (s) => s.hours >= 100 },
];

/** Plus longue série de jours consécutifs (clés YYYY-MM-DD). */
export function bestStreakDays(keys: Iterable<string>) {
  const set = new Set(keys); let best = 0;
  for (const k of set) {
    if (set.has(shiftDay(k, -1))) continue;
    let n = 0, c = k;
    while (set.has(c)) { n++; c = shiftDay(c, 1); }
    best = Math.max(best, n);
  }
  return best;
}
