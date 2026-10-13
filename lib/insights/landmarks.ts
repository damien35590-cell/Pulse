/** Comparaisons imagées : variées et déterministes (même graine = même repère), pour ne plus tout ramener à la tour Eiffel. */
const fr = (n: number, d = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: d });
const hash = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

type Climb = { m: number; label: string; short: string };
export const CLIMBS: Climb[] = [
  { m: 210, label: "la tour Montparnasse", short: "Montparnasse" },
  { m: 330, label: "la tour Eiffel", short: "Eiffel" },
  { m: 443, label: "l’Empire State Building", short: "Empire State" },
  { m: 828, label: "le Burj Khalifa", short: "Burj Khalifa" },
  { m: 1100, label: "la montée de l’Alpe d’Huez", short: "Alpe d’Huez" }, // ≈ 1 070 m de D+
  { m: 1400, label: "la montée du Tourmalet (côté Luz)", short: "Tourmalet" }, // ≈ 1 400 m
  { m: 1600, label: "la montée du Mont Ventoux (côté Bédoin)", short: "Ventoux" }, // ≈ 1 600 m
];

export function climbCompare(m: number, seed: string) {
  if (!(m >= 190)) return null;
  const ok = CLIMBS.filter((c) => m / c.m >= 0.9 && m / c.m <= 6);
  const c = ok.length ? ok[hash(seed) % ok.length] : CLIMBS[CLIMBS.length - 1], r = m / c.m;
  const short = r < 1.1 ? c.short : `${fr(r)} × ${c.short}`;
  const text = r < 0.97 ? `presque ${c.label}` : r < 1.1 ? `tout juste ${c.label}` : `${fr(r)} fois ${c.label}`;
  return { r, short, text };
}

type Dist = { km: number; one: string; name: string };
const DISTS: Dist[] = [
  { km: 42.195, one: "un marathon", name: "marathons" },
  { km: 130, one: "un Paris–Orléans", name: "Paris–Orléans" }, // ≈ 130 km par la route
  { km: 200, one: "un Marseille–Nice", name: "Marseille–Nice" }, // ≈ 200 km
  { km: 465, one: "un Paris–Lyon", name: "Paris–Lyon" }, // ≈ 465 km
];
export function distanceCompare(km: number, seed: string) {
  const ok = DISTS.filter((d) => km / d.km >= 0.9 && km / d.km <= 8);
  if (!ok.length) return null;
  const d = ok[hash(seed) % ok.length], r = km / d.km;
  return r < 1.1 ? { short: d.one.replace(/^un /, "1 "), text: `tout juste ${d.one}` } : { short: `${fr(r)} ${d.name}`, text: `environ ${fr(r)} ${d.name}` };
}

type Mass = { kg: number; one: string; many: string };
const MASSES: Mass[] = [
  { kg: 300, one: "un piano à queue", many: "pianos à queue" },
  { kg: 600, one: "une Citroën 2 CV", many: "Citroën 2 CV" },
  { kg: 1500, one: "un hippopotame", many: "hippopotames" },
  { kg: 6000, one: "un éléphant d’Afrique", many: "éléphants d’Afrique" },
];
export function tonnageCompare(kg: number, seed: string) {
  if (!(kg >= 270)) return null;
  const ok = MASSES.filter((m) => kg / m.kg >= 0.9 && kg / m.kg <= 12);
  const m = ok.length ? ok[hash(seed) % ok.length] : MASSES[MASSES.length - 1], r = kg / m.kg;
  return r < 1.5 ? `à peu près ${m.one}` : `environ ${fr(r)} ${m.many}`;
}
