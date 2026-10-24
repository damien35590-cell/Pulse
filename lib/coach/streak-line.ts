/**
 * Phrase de série (« 14e sortie consécutive. 5,4 km à 7:51/km. ») : sobre, factuelle, sans encouragement (doctrine : lib/coach/doctrine.ts).
 * Pure et déterministe : la variante dépend de l'id de l'activité, pour que le fil ne répète pas la même ligne.
 */
import { fmtDuration, fmtKm, fmtNum, fmtPace, ordinalFr } from "../format";

export type StreakInput = { id: string; type: string; n: number; distanceM: number; movingTimeS: number; elevationGainM: number };

/** Nom du sport : rando, séance (muscu), sortie (course, vélo, marche…). */
export const sportNoun = (type: string) => (type === "HIKE" ? "rando" : type === "WORKOUT" ? "séance" : "sortie");

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

function facts(a: StreakInput): string {
  const km = a.distanceM >= 100 ? `${fmtKm(a.distanceM)} km` : null;
  if (a.type === "WORKOUT") return a.movingTimeS > 0 ? `${fmtDuration(a.movingTimeS)}.` : "";
  if (a.type === "HIKE") return [km, a.elevationGainM > 0 ? `D+ ${fmtNum(a.elevationGainM, 0)} m` : null].filter(Boolean).join(", ") + (km ? "." : "");
  const p = fmtPace(a.distanceM, a.movingTimeS, a.type === "EBIKE" ? "RIDE" : a.type);
  return km ? `${km}${p ? ` à ${p.value}${p.unit === "km/h" ? " " : ""}${p.unit}` : ""}.` : "";
}

export function streakLine(a: StreakInput): string {
  const noun = sportNoun(a.type), ord = ordinalFr(a.n), f = facts(a);
  const variants = [
    `${ord} ${noun} consécutive.`,
    `${ord} ${noun} d'affilée.`,
    a.n > 1 ? `Série en cours : ${a.n} ${noun}s consécutives.` : `${ord} ${noun} de la série.`,
    `${ord} ${noun} consécutive${f ? " :" : "."}`,
  ];
  const v = hash(a.id) % variants.length;
  const head = variants[v];
  if (!f) return head;
  return v === 3 ? `${head} ${f.charAt(0).toLowerCase()}${f.slice(1)}` : `${head} ${f}`;
}

/** Numéro de série lu dans une ancienne phrase (« 16ème sortie de suite… ») ou dans une phrase déjà régénérée ; null sinon. */
export function streakNumber(story: string): number | null {
  const m = story.match(/^(\d+)(?:ème|e|re|er) \S+ (?:de suite|consécutive|d'affilée)/) ?? story.match(/^Série en cours : (\d+) /);
  return m ? Number(m[1]) : null;
}
