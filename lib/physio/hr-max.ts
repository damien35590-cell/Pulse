/**
 * FC max estimée. Deux sources, la plus haute gagne :
 * - observée : meilleure moyenne glissante sur 5 s de la FC des 12 derniers mois (pics de capteur écartés) ;
 * - formule de Tanaka, 208 − 0,7 × âge, si une date de naissance est connue.
 * `User` n'a pas de date de naissance (seulement `ageBand`, une tranche : trop floue pour une formule à 0,7 bpm par an) et on n'en ajoute pas :
 * pour l'instant seule la valeur observée compte. `combineHrMax` accepte déjà l'âge pour le jour où le champ existera.
 * Une FC max saisie (UserZones.hrMax) prime toujours : l'estimation vit à part (UserZones.hrMaxEstimate) et n'est calculée que sans saisie.
 */
import { prisma } from "@/lib/prisma";
import { buildStream } from "@/lib/stream";
import type { TrackPoint } from "@/lib/import/types";

/** Fenêtre de la moyenne glissante (s). */
export const PEAK_WINDOW_S = 5;
/** Au-delà : pic de capteur. */
export const SPIKE_ABOVE_BPM = 220;
/** Écart entre deux secondes consécutives au-delà duquel la mesure est un pic de capteur (le cœur ne saute pas de 30 bpm en 1 s). */
export const SPIKE_JUMP_BPM = 30;
export const LOOKBACK_DAYS = 365;
/** Mêmes bornes que la saisie dans Vous › Seuils : en dessous, on n'a pas vu d'effort maximal, pas une FC max. */
export const HR_MAX_RANGE = [120, 230] as const;

/** Meilleure moyenne de FC sur 5 s consécutives d'une série à 1 Hz (0 = pas de mesure), ou null. Fenêtre sans trou ni pic : une seule seconde douteuse l'écarte. */
export function peakHr(hr: number[]): number | null {
  const ok: boolean[] = new Array(hr.length);
  for (let i = 0; i < hr.length; i++) {
    const v = hr[i], prev = i > 0 ? hr[i - 1] : 0;
    ok[i] = v > 0 && v <= SPIKE_ABOVE_BPM && (prev <= 0 || Math.abs(v - prev) <= SPIKE_JUMP_BPM);
  }
  let best: number | null = null, streak = 0, sum = 0;
  for (let i = 0; i < hr.length; i++) {
    if (!ok[i]) { streak = 0; sum = 0; continue; }
    streak++;
    sum += hr[i];
    if (streak > PEAK_WINDOW_S) sum -= hr[i - PEAK_WINDOW_S];
    if (streak >= PEAK_WINDOW_S) { const mean = sum / PEAK_WINDOW_S; if (best == null || mean > best) best = mean; }
  }
  return best == null ? null : Math.round(best);
}

/** Tanaka et al. (2001) : 208 − 0,7 × âge. */
export const tanaka = (ageYears: number) => Math.round(208 - 0.7 * ageYears);

export type HrMaxSource = "observed" | "formula";
export type HrMaxEstimate = { value: number | null; source: HrMaxSource | null; observed: number | null; formula: number | null };

const plausible = (v: number | null): v is number => v != null && v >= HR_MAX_RANGE[0] && v <= HR_MAX_RANGE[1];

/** La plus haute des deux valeurs plausibles ; à égalité, la valeur observée. Null sans aucune des deux. */
export function combineHrMax(observed: number | null, ageYears?: number | null): HrMaxEstimate {
  const o = plausible(observed) ? observed : null;
  const f = ageYears != null && ageYears > 0 ? tanaka(ageYears) : null;
  const formula = plausible(f) ? f : null;
  if (o == null && formula == null) return { value: null, source: null, observed: o, formula };
  const useFormula = formula != null && (o == null || formula > o);
  return { value: useFormula ? formula : o, source: useFormula ? "formula" : "observed", observed: o, formula };
}

const CHUNK = 25;
const hrOf = (raw: unknown) => (Array.isArray(raw) ? (raw as number[]) : []);

/** Plus haute moyenne 5 s sur les activités des 12 derniers mois dotées d'une FC : série 1 Hz d'abord, à défaut trace compactée. */
async function observedPeak(userId: string, now: Date): Promise<number | null> {
  const since = new Date(+now - LOOKBACK_DAYS * 864e5);
  let best: number | null = null;
  const bump = (v: number | null) => { if (v != null && (best == null || v > best)) best = v; };

  const streamIds = (await prisma.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM "Activity" a JOIN "ActivityStream" s ON s."activityId" = a.id
    WHERE a."userId" = ${userId} AND a."startedAt" >= ${since}
      AND CASE WHEN jsonb_typeof(s.data->'hr') = 'array' THEN jsonb_array_length(s.data->'hr') ELSE 0 END > 0`).map((r) => r.id);
  for (let i = 0; i < streamIds.length; i += CHUNK) {
    const rows = await prisma.$queryRaw<{ hr: unknown }[]>`SELECT s.data->'hr' AS hr FROM "ActivityStream" s WHERE s."activityId" = ANY(${streamIds.slice(i, i + CHUNK)})`;
    for (const r of rows) bump(peakHr(hrOf(r.hr)));
  }

  // Activités sans série 1 Hz mais dont la trace compactée porte la FC (imports d'avant les séries).
  const trackIds = (await prisma.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM "Activity" a
    WHERE a."userId" = ${userId} AND a."startedAt" >= ${since} AND a."trackPoints" IS NOT NULL AND a."trackPoints"::text LIKE '%"hr"%'
      AND NOT EXISTS (SELECT 1 FROM "ActivityStream" s WHERE s."activityId" = a.id
        AND CASE WHEN jsonb_typeof(s.data->'hr') = 'array' THEN jsonb_array_length(s.data->'hr') ELSE 0 END > 0)`).map((r) => r.id);
  for (let i = 0; i < trackIds.length; i += CHUNK) {
    const rows = await prisma.activity.findMany({ where: { id: { in: trackIds.slice(i, i + CHUNK) } }, select: { trackPoints: true } });
    for (const r of rows) bump(peakHr(buildStream(Array.isArray(r.trackPoints) ? (r.trackPoints as unknown as TrackPoint[]) : [])?.hr ?? []));
  }
  return best;
}

/** Estimation de FC max d'un utilisateur d'après ses 12 derniers mois. Lecture seule. */
export async function estimateHrMax(userId: string, now = new Date()): Promise<HrMaxEstimate> {
  return combineHrMax(await observedPeak(userId, now));
}

export type HrMaxRefresh = { skipped: "manual" | null; before: number | null; after: number | null; source: HrMaxSource | null };

/**
 * Recalcule et enregistre UserZones.hrMaxEstimate, sauf si l'utilisateur a saisi sa FC max (rien n'est lu ni écrit).
 * La colonne de saisie n'est jamais touchée : une valeur saisie pendant le calcul ne peut pas être écrasée.
 */
export async function refreshEstimatedHrMax(userId: string): Promise<HrMaxRefresh> {
  const z = await prisma.userZones.findUnique({ where: { userId }, select: { hrMax: true, hrMaxEstimate: true } });
  const before = z?.hrMaxEstimate ?? null;
  if (z?.hrMax != null) return { skipped: "manual", before, after: before, source: null };
  const est = await estimateHrMax(userId);
  if (est.value !== before) await prisma.userZones.upsert({ where: { userId }, update: { hrMaxEstimate: est.value }, create: { userId, hrMaxEstimate: est.value } });
  return { skipped: null, before, after: est.value, source: est.source };
}
