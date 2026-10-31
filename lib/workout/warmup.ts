/**
 * Échauffement d'une séance de muscu (corde à sauter, gym / mobilité…), fait avant le premier exercice.
 * Il vit à part des exercices (Activity.warmup, jamais une ligne WorkoutExercise) : il n'entre ni dans les totaux, ni dans la progression Lafay,
 * ni dans les barres, les cartes d'exercice, le coach ou les badges. Seule la durée de la séance le compte (la séance commence avec lui).
 * Fonctions pures (tests : tools/test-warmup.ts).
 */
import type { HrSample } from "./hr";

/** Un élément proposé (réglages, début de séance) : nom et durée visée en minutes. */
export type WarmupItem = { name: string; min: number };
/** Un élément fait : durée réelle au chrono, durée visée. */
export type WarmupDone = { name: string; durationS: number; targetS?: number };
/** Échauffement enregistré avec la séance. `endS` : fin de l'échauffement en secondes depuis Activity.startedAt (la FC d'après est celle de la muscu). */
export type Warmup = { v: 1; items: WarmupDone[]; endS: number };

/** Échauffement en cours sur le téléphone : `since` = instant (ms) où le chrono de l'élément a été lancé, null à l'arrêt. */
export type WarmupLiveItem = { id: string; name: string; targetS: number; elapsedS: number; since: number | null };
/** `done` : terminé ou passé ; la séance passe aux exercices. `endedAt` : instant (ms) de la fin. */
export type WarmupLive = { items: WarmupLiveItem[]; done: boolean; endedAt?: number };

export const DEFAULT_WARMUP: WarmupItem[] = [{ name: "Corde à sauter", min: 3 }, { name: "Gym / mobilité", min: 5 }];
export const WARMUP_MAX_ITEMS = 8;
export const WARMUP_NAME_MAX = 40;
export const WARMUP_MAX_MIN = 60;

const name = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, WARMUP_NAME_MAX) : "");

/** Liste saisie dans les réglages → liste propre (noms non vides, 1 à 60 min, 8 au plus). */
export function cleanWarmupDefaults(v: unknown): WarmupItem[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => ({ name: name(x?.name), min: Math.round(Number(x?.min)) }))
    .filter((x) => x.name && x.min >= 1 && x.min <= WARMUP_MAX_MIN)
    .slice(0, WARMUP_MAX_ITEMS);
}

/** Réglage lu en base (User.warmupDefaults) : null = jamais réglé → corde 3 min + gym 5 min ; [] = pas d'échauffement. */
export const warmupDefaults = (v: unknown): WarmupItem[] => (v == null ? DEFAULT_WARMUP : cleanWarmupDefaults(v));

/** Résumé des réglages : « Corde à sauter 3 min · Gym / mobilité 5 min », « Aucun ». */
export const warmupSummary = (items: WarmupItem[]) => (items.length ? items.map((x) => `${x.name} ${x.min} min`).join(" · ") : "Aucun");

/** Début de séance : l'échauffement proposé, chronos à zéro ; null sans élément (rien à afficher). */
export function startWarmup(items: WarmupItem[], ids: () => string = () => Math.random().toString(36).slice(2, 10)): WarmupLive | null {
  return items.length ? { items: items.map((x) => ({ id: ids(), name: x.name, targetS: x.min * 60, elapsedS: 0, since: null })), done: false } : null;
}

/** Temps au chrono d'un élément à l'instant `now` (ms). */
export const elapsedOf = (x: WarmupLiveItem, now: number) => x.elapsedS + (x.since != null ? Math.max(0, Math.floor((now - x.since) / 1000)) : 0);
/** Un chrono a déjà tourné : la séance est commencée (elle se reprend après un rafraîchissement). */
export const warmupStarted = (w: WarmupLive | null | undefined) => !!w && w.items.some((x) => x.since != null || x.elapsedS > 0);

/** Arrête tous les chronos (le temps couru est ajouté à `elapsedS`), puis lance celui de `id` si donné. */
export function runItem(w: WarmupLive, id: string | null, now: number): WarmupLive {
  return { ...w, items: w.items.map((x) => ({ ...x, elapsedS: elapsedOf(x, now), since: x.id === id ? now : null })) };
}

/** Fin de l'échauffement : chronos arrêtés, `done`. `skip` (« Passer l'échauffement ») : tout est oublié, rien ne sera enregistré. */
export function finishWarmup(w: WarmupLive, now: number, skip = false): WarmupLive {
  return skip ? { items: [], done: true, endedAt: now } : { ...runItem(w, null, now), done: true, endedAt: now };
}

/** Échauffement envoyé avec la séance ; undefined s'il a été passé ou si aucun chrono n'a tourné. */
export function warmupPayload(w: WarmupLive | null | undefined, startedAt: number, now: number): Warmup | undefined {
  if (!w) return undefined;
  const items = w.items.map((x) => ({ name: x.name, durationS: elapsedOf(x, now), targetS: x.targetS })).filter((x) => x.durationS > 0);
  if (!items.length) return undefined;
  // Fin : celle de l'échauffement s'il est fini (séance commencée ensuite), sinon maintenant ; jamais avant la somme des chronos.
  const total = items.reduce((s, x) => s + x.durationS, 0);
  return { v: 1, items, endS: Math.max(total, Math.round(((w.endedAt ?? now) - startedAt) / 1000)) };
}

/** Corps de requête reçu → échauffement propre (8 éléments, 1 s à 1 h chacun, fin dans la séance) ; undefined = rien à enregistrer. */
export function cleanWarmup(v: unknown, movingTimeS: number): Warmup | undefined {
  const raw = (v as { items?: unknown })?.items;
  if (!Array.isArray(raw)) return undefined;
  const items = raw.slice(0, WARMUP_MAX_ITEMS).map((x) => {
    const durationS = Math.round(Number(x?.durationS)), targetS = Math.round(Number(x?.targetS));
    return { name: name(x?.name), durationS, ...(targetS > 0 && targetS <= 3600 ? { targetS } : {}) };
  }).filter((x) => x.name && x.durationS > 0 && x.durationS <= 3600);
  if (!items.length) return undefined;
  const total = items.reduce((s, x) => s + x.durationS, 0), endS = Math.round(Number((v as { endS?: unknown }).endS));
  return { v: 1, items, endS: Math.min(Math.max(movingTimeS, 0), Number.isFinite(endS) && endS >= total ? endS : total) };
}

/** Lecture en base (Activity.warmup) ; null si absent ou illisible. */
export function warmupOf(v: unknown): Warmup | null {
  const w = v as Warmup | null;
  return w && Array.isArray(w.items) && w.items.length ? w : null;
}

/** FC de la muscu seule : les échantillons d'après l'échauffement, remis à zéro sur sa fin. Sans échauffement : tout. */
export const liftSamples = (s: HrSample[], w: Warmup | null): HrSample[] => (w ? s.filter((x) => x.t >= w.endS).map((x) => ({ t: x.t - w.endS, bpm: x.bpm })) : s);

const dur = (s: number) => (s < 60 ? `${s} s` : `${Math.round(s / 60)} min`);
/** « corde », « gym » : premier mot du nom, en minuscules. */
const short = (n: string) => (n.split(/[\s/,·-]+/).find(Boolean) ?? n).toLocaleLowerCase("fr-FR");

/** Ligne de la fiche : « Échauffement 8 min · corde 3 min, gym 5 min » ; null sans échauffement. */
export function warmupLine(w: Warmup | null): string | null {
  if (!w) return null;
  const total = w.items.reduce((s, x) => s + x.durationS, 0);
  return `Échauffement ${dur(total)} · ${w.items.map((x) => `${short(x.name)} ${dur(x.durationS)}`).join(", ")}`;
}
