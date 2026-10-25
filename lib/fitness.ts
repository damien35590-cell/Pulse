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
  if (form > 20) return { label: "Transition", tip: "Vous récupérez beaucoup : reprenez du volume." };
  if (form > 5) return { label: "Frais", tip: "Bon moment pour une séance clé ou une compétition." };
  if (form > -10) return { label: "Zone neutre", tip: "Charge stable : vous pouvez avancer." };
  if (form > -30) return { label: "Optimal", tip: "Vous progressez : cette fatigue est productive." };
  return { label: "Risque élevé", tip: "Fatigue très forte : prévoyez du repos." };
}
