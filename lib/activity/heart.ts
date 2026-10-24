import { bounds, HR_PCT, timeInZones, ZONES } from "@/lib/zones";
import type { ZoneSlice } from "@/components/activity/zone-bar";

/** Pas de la courbe de FC (s) : assez fin pour voir les fractions, assez léger pour le navigateur. */
export const HR_STEP_S = 5;

/**
 * FC d'une activité pour la fiche : courbe moyennée par paquets de 5 s (trous de capteur exclus), bornes et temps par zone
 * si la FC max est connue. `hr` : série à 1 Hz (lib/stream.ts), 0 = pas de mesure. Null sans mesure exploitable.
 */
export function heartRate(hr: number[], hrMax?: number | null) {
  const values: number[] = [];
  for (let i = 0; i < hr.length; i += HR_STEP_S) {
    const chunk = hr.slice(i, i + HR_STEP_S).filter((v) => v > 0);
    if (chunk.length) values.push(chunk.reduce((s, v) => s + v, 0) / chunk.length);
  }
  if (values.length < 6) return null;
  const upper = hrMax ? bounds(hrMax, HR_PCT) : null;
  const zones: ZoneSlice[] | null = upper && timeInZones(hr, upper, true).map((seconds, i) => ({
    id: ZONES[i].id, name: ZONES[i].name, seconds,
    range: i === 0 ? `< ${upper[0]}` : i === upper.length ? `> ${upper[i - 1]}` : `${upper[i - 1]}–${upper[i]}`,
  }));
  return { values, upper, zones, durationS: hr.length };
}
