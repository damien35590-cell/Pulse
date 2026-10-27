/**
 * Fréquence cardiaque d'une séance de muscu (ceinture BLE) : nettoyage de la série reçue, moyenne / max, pic et FC en fin de repos de chaque série.
 * Fonctions pures, sans base ni navigateur (tests : tools/test-heart-rate.ts). Le client envoie la série brute, le serveur calcule tout.
 */

/** Un échantillon : secondes écoulées depuis le début de la séance (Activity.startedAt), battements par minute. */
export type HrSample = { t: number; bpm: number };

/** Hors de cette plage, la valeur est un contact perdu ou un parasite : écartée. */
export const HR_MIN = 30;
export const HR_MAX = 250;
/** Une séance de 4 h à 1 Hz : au-delà, on garde le début. */
export const HR_MAX_SAMPLES = 14400;
/** Sous ce nombre d'échantillons, une connexion de quelques secondes ne fait pas une « séance avec FC ». */
export const HR_MIN_SAMPLES = 30;

/** Fenêtre d'effort d'une série : au plus 60 s avant sa validation, 10 s après (la FC culmine juste après l'effort). */
const SET_LEAD_S = 60;
const SET_TAIL_S = 10;
/** FC « en fin de repos » : moyenne des échantillons des 4 dernières secondes du repos. */
const REST_WINDOW_S = 4;
/** Il faut au moins 3 séries avec un pic ET une fin de repos pour parler d'une baisse moyenne. */
export const MIN_DROP_SETS = 3;

/** Série reçue du client → échantillons valides, triés, un par seconde, 4 h au plus. Tableau vide si le format est inattendu. */
export function cleanHrSeries(v: unknown): HrSample[] {
  if (!Array.isArray(v)) return [];
  const bySecond = new Map<number, number>();
  for (const x of v) {
    const t = Math.round(Number((x as HrSample)?.t)), bpm = Math.round(Number((x as HrSample)?.bpm));
    if (!Number.isFinite(t) || !Number.isFinite(bpm) || t < 0 || t > 86400 || bpm < HR_MIN || bpm > HR_MAX) continue;
    if (!bySecond.has(t)) bySecond.set(t, bpm);
  }
  return [...bySecond].sort((a, b) => a[0] - b[0]).slice(0, HR_MAX_SAMPLES).map(([t, bpm]) => ({ t, bpm }));
}

/** FC moyenne et max de la séance, ou null s'il y a trop peu d'échantillons. */
export function hrStats(s: HrSample[]): { avg: number; max: number } | null {
  if (s.length < HR_MIN_SAMPLES) return null;
  return { avg: Math.round(s.reduce((a, x) => a + x.bpm, 0) / s.length), max: Math.max(...s.map((x) => x.bpm)) };
}

/** Une série du détail enregistré (WorkoutExercise.setsDetail) : seuls les champs utiles ici. */
export type HrSet = {
  /** Instant de validation (ISO). */
  completedAt?: string;
  /** Repos réellement pris après cette série, en secondes. */
  restTakenS?: number;
  hrPeak?: number | null;
  hrEndRest?: number | null;
};

const between = (s: HrSample[], from: number, to: number) => s.filter((x) => x.t >= from && x.t <= to);

/**
 * Pic et FC en fin de repos de chaque série, écrits dans `hrPeak` / `hrEndRest` (modifie les séries en place).
 * - Fenêtre de la série : de la fin du repos précédent (ou 60 s avant la validation si plus court) à 10 s après la validation.
 * - Fin de repos : validation + repos réellement pris ; absent (dernière série sans repos…) → pas de valeur.
 * Les séries sont rangées par instant de validation, tous exercices confondus ; sans `completedAt`, la série est ignorée.
 */
export function annotateSets(exercises: { setsDetail?: unknown }[], series: HrSample[], startedAtMs: number): void {
  if (!series.length) return;
  const sets = exercises.flatMap((e) => (Array.isArray(e.setsDetail) ? (e.setsDetail as HrSet[]) : []))
    .map((s) => ({ s, c: s.completedAt ? (Date.parse(s.completedAt) - startedAtMs) / 1000 : NaN }))
    .filter((x) => Number.isFinite(x.c) && x.c >= 0)
    .sort((a, b) => a.c - b.c);
  sets.forEach(({ s, c }, i) => {
    const prev = sets[i - 1], prevRest = prev ? prev.c + (prev.s.restTakenS ?? 0) : 0;
    const from = Math.max(c - SET_LEAD_S, prev ? Math.min(prevRest, c) : 0);
    const peak = between(series, from, c + SET_TAIL_S);
    if (peak.length) s.hrPeak = Math.max(...peak.map((x) => x.bpm));
    if (s.restTakenS != null && s.restTakenS > 0) {
      const end = c + s.restTakenS, rest = between(series, end - REST_WINDOW_S, end);
      if (rest.length) s.hrEndRest = Math.round(rest.reduce((a, x) => a + x.bpm, 0) / rest.length);
    }
  });
}

/** Baisse moyenne de FC pendant les repos (pic − fin de repos), en bpm ; null s'il y a moins de 3 séries mesurées. */
export function restDrop(sets: HrSet[]): { bpm: number; sets: number } | null {
  const drops = sets.filter((s) => s.hrPeak != null && s.hrEndRest != null).map((s) => s.hrPeak! - s.hrEndRest!);
  if (drops.length < MIN_DROP_SETS) return null;
  return { bpm: Math.round(drops.reduce((a, d) => a + d, 0) / drops.length), sets: drops.length };
}

/** Séries d'un ou plusieurs exercices (JSON `setsDetail`) à plat. */
export const setsOf = (details: unknown[]): HrSet[] => details.flatMap((d) => (Array.isArray(d) ? (d as HrSet[]) : []));

/**
 * Série irrégulière → une valeur par seconde (courbe de la fiche et temps par zone). Un trou de capteur de 10 s au plus
 * reprend la dernière valeur ; au-delà, 0 (= pas de mesure, ignoré par `heartRate`).
 */
export function toSecondSeries(s: HrSample[], holdS = 10): number[] {
  if (!s.length) return [];
  const out = new Array<number>(s[s.length - 1].t + 1).fill(0);
  s.forEach((x, i) => {
    const until = Math.min(x.t + holdS, (s[i + 1]?.t ?? Infinity) - 1, out.length - 1);
    for (let t = x.t; t <= until; t++) out[t] = x.bpm;
  });
  return out;
}
