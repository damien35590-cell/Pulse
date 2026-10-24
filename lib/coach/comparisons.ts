/**
 * Catalogue de comparaisons pour les activités exceptionnelles (lib/coach/story.ts). Trois échelles : hauteurs / longueurs (m, pour le D+),
 * distances (km) et masses (kg, pour le volume soulevé). Aucune référence n'est favorisée : le choix est déterministe, d'après l'id de l'activité,
 * et évite les références déjà utilisées dans les dernières anecdotes du sport. Ordres de grandeur arrondis, volontairement.
 */
import { fmtNum } from "../format";

export type Scale = "height" | "distance" | "mass";
type Ref = { name: string; v: number };

/** Hauteur ou longueur, en mètres. `name` suit « soit N fois … ». */
const HEIGHTS: Ref[] = [
  { name: "la tour Montparnasse", v: 210 }, { name: "le Burj Khalifa", v: 828 }, { name: "l'Empire State Building", v: 443 },
  { name: "la tour Eiffel", v: 330 }, { name: "le viaduc de Millau", v: 343 }, { name: "la flèche de la cathédrale de Strasbourg", v: 142 },
  { name: "la grande pyramide de Khéops", v: 139 }, { name: "la Sagrada Família", v: 172 }, { name: "la statue de la Liberté", v: 93 },
  { name: "Big Ben", v: 96 }, { name: "le Mont-Saint-Michel", v: 80 }, { name: "le phare d'Ar-Men", v: 35 },
  { name: "le Roc'h Ruz, point culminant de la Bretagne", v: 385 }, { name: "le Ménez Hom", v: 330 }, { name: "le Puy de Dôme", v: 1465 },
  { name: "le Ballon d'Alsace", v: 1247 }, { name: "le mont Aigoual", v: 1567 }, { name: "le mont Ventoux", v: 1910 },
  { name: "le Pic du Midi de Bigorre", v: 2877 }, { name: "l'Aiguille du Midi", v: 3842 }, { name: "le mont Fuji", v: 3776 },
  { name: "le Cervin", v: 4478 }, { name: "le mont Blanc", v: 4806 }, { name: "le Kilimandjaro", v: 5895 }, { name: "l'Everest", v: 8849 },
  { name: "la longueur d'une rame de TGV", v: 200 }, { name: "la longueur d'un Airbus A380", v: 73 }, { name: "la longueur d'une baleine bleue", v: 25 },
  { name: "la hauteur d'un séquoia géant", v: 80 }, { name: "la hauteur d'une girafe adulte", v: 5.5 }, { name: "la longueur d'un terrain de football", v: 105 },
  { name: "la longueur du paquebot Queen Mary 2", v: 345 },
];

/** Distances, en kilomètres. */
const DISTANCES: Ref[] = [
  { name: "la distance Rennes–Saint-Malo", v: 70 }, { name: "la distance Rennes–Nantes", v: 110 }, { name: "la distance Rennes–Brest", v: 245 },
  { name: "la distance Rennes–Vannes", v: 110 }, { name: "la distance Brest–Quimper", v: 70 }, { name: "la distance Quimper–Lorient", v: 70 },
  { name: "la distance Lorient–Vannes", v: 65 }, { name: "la distance Saint-Brieuc–Rennes", v: 100 }, { name: "la distance Le Mans–Rennes", v: 155 },
  { name: "la distance Nantes–La Rochelle", v: 140 }, { name: "la distance Paris–Rouen", v: 135 }, { name: "la distance Paris–Lille", v: 225 },
  { name: "la distance Paris–Lyon", v: 465 }, { name: "la distance Lyon–Marseille", v: 315 }, { name: "la distance Bordeaux–Toulouse", v: 245 },
  { name: "la distance Paris–Versailles", v: 17 }, { name: "la longueur du tunnel du Mont-Blanc", v: 11.6 }, { name: "la longueur du tunnel du Fréjus", v: 13 },
  { name: "la longueur du lac d'Annecy", v: 14.6 }, { name: "la longueur de l'île de Noirmoutier", v: 19 }, { name: "la longueur de l'île de Ré", v: 30 }, { name: "le tour du périphérique parisien", v: 35 }, { name: "la traversée de la Manche, de Douvres à Calais", v: 34 }, { name: "la longueur du tunnel sous la Manche", v: 50 },
  { name: "la longueur d'un marathon", v: 42.195 }, { name: "la distance Paris–Roubaix", v: 257 }, { name: "le tour du mont Blanc", v: 170 },
  { name: "la longueur du canal de Nantes à Brest", v: 360 },
];

/** Masses, en kilogrammes. */
const MASSES: Ref[] = [
  { name: "le poids d'un labrador", v: 30 }, { name: "le poids d'un panda géant", v: 120 }, { name: "le poids d'un cheval", v: 500 },
  { name: "le poids d'une Renault Clio", v: 1100 }, { name: "le poids d'un hippopotame", v: 1500 }, { name: "le poids d'un rhinocéros blanc", v: 2300 },
  { name: "le poids d'un éléphant d'Afrique", v: 6000 }, { name: "le poids d'un tyrannosaure", v: 8000 }, { name: "le poids d'un autobus urbain", v: 12000 },
  { name: "le poids d'un Airbus A320 à vide", v: 42000 }, { name: "le poids d'un piano à queue", v: 400 }, { name: "le poids d'un ours brun", v: 300 },
];

const CATALOGUE: Record<Scale, Ref[]> = { height: HEIGHTS, distance: DISTANCES, mass: MASSES };
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Rapport en fois, une décimale sous 10. */
const times = (r: number) => fmtNum(r, r < 10 ? 1 : 0);

/**
 * « soit 1,7 fois le Burj Khalifa » : une référence dont le rapport à `value` tient entre 0,9 et 30, jamais l'une de celles de `recent`
 * (textes des dernières anecdotes du sport). `value` en m, km ou kg selon l'échelle. Null si rien ne convient.
 */
export function comparisonFor(scale: Scale, value: number, id: string, recent: string[] = []): string | null {
  if (!(value > 0)) return null;
  const ok = CATALOGUE[scale].filter((r) => value / r.v >= 0.9 && value / r.v <= 30);
  const fresh = ok.filter((r) => !recent.some((t) => t.includes(r.name)));
  const pool = fresh.length ? fresh : ok;
  if (!pool.length) return null;
  const ref = pool[hash(id) % pool.length], r = value / ref.v;
  return r < 1.1 ? `soit environ ${ref.name}` : `soit ${times(r)} fois ${ref.name}`;
}
