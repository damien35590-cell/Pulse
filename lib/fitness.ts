import { dayKey, shiftDay } from "./dates";
import { estimateLoad } from "./load";
import { isSoftActivity } from "./sports";

/** Facteurs d'intensité par sport (estimation), désormais définis dans lib/load.ts. */
export { INTENSITY } from "./load";
export type Fit = { key: string; load: number; ctl: number; atl: number; form: number };

/**
 * Fitness (moyenne mobile 42 j), fatigue (7 j) et forme = fitness − fatigue, jour par jour.
 * Charge de chaque activité : `load` calculée à l'enregistrement (lib/load.ts), à défaut l'estimation par sport.
 */
export function fitnessSeries(acts: { startedAt: Date; movingTimeS: number; type: string; load?: number | null }[], now: Date, tz: string, days = 300): Fit[] {
  const load: Record<string, number> = {};
  for (const a of acts) { const k = dayKey(a.startedAt, tz); load[k] = (load[k] ?? 0) + (a.load ?? estimateLoad(a)); }
  const today = dayKey(now, tz); let c = 0, f = 0; const out: Fit[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = shiftDay(today, -i), l = load[k] ?? 0;
    c += (l - c) / 42; f += (l - f) / 7;
    out.push({ key: k, load: l, ctl: c, atl: f, form: c - f });
  }
  return out;
}

/** Historique lu pour la forme : la fitness est une moyenne mobile sur 42 j, elle a besoin de mois de recul pour être juste. */
export const FITNESS_HISTORY_DAYS = 330;

/**
 * LA série de forme de l'app (accueil, Forme physique, Analyse, coach) : activités douces (vélotaf, marche) exclues avec `isSoftActivity`.
 * `acts` doit porter `source`, `dedupeKey` et `title` pour que la règle soit complète.
 */
export function formSeries(acts: (Parameters<typeof fitnessSeries>[0][number] & { source?: string | null; dedupeKey?: string | null; title?: string | null })[], now: Date, tz: string, days = 300): Fit[] {
  return fitnessSeries(acts.filter((a) => !isSoftActivity(a)), now, tz, days);
}

export function zone(form: number) {
  if (form > 20) return { label: "Transition", tip: "Tu récupères beaucoup : reprends du volume." };
  if (form > 5) return { label: "Frais", tip: "Bon moment pour une séance clé ou une compétition." };
  if (form > -10) return { label: "Zone neutre", tip: "Charge stable : tu peux avancer." };
  if (form > -30) return { label: "Optimal", tip: "Tu progresses : cette fatigue est productive." };
  return { label: "Risque élevé", tip: "Fatigue très forte : prévois du repos." };
}

/** Hausse de fitness sur 7 jours au-delà de laquelle le rythme est trop rapide (même seuil que le coach de l'Analyse). */
export const FAST_CTL_GAIN = 8;
/** Baisse de fitness sur 7 jours en deçà de laquelle on parle de perte (au-dessus : stable). */
export const CTL_LOSS = 3;

/**
 * Couleur de l'écart de fitness sur 7 jours (tuile Forme) : ce que le changement veut dire pour toi, accordé à l'état de forme affiché.
 * Hausse = progrès, sauf trop rapide ou en « Risque élevé » (à surveiller). Légère baisse = stable. Baisse nette = à surveiller,
 * sauf quand tu es frais ou en transition : c'est le prix normal de la récupération. Jamais rouge : une baisse de fitness n'est pas une alerte.
 */
export function formDeltaTone(delta: number, form: number): "good" | "warn" | "neutral" {
  if (delta > 0) return delta > FAST_CTL_GAIN || form <= -30 ? "warn" : "good";
  if (delta > -CTL_LOSS) return "neutral";
  return form > 5 ? "neutral" : "warn";
}
