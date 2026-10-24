/**
 * Ruban de zones d'une activité (art, voir docs/design-system.md règle 8) : la séance découpée en ~40 tranches de durée égale,
 * chacune classée dans la zone de sa valeur moyenne (mêmes bornes que TraceChart / ZoneBar : lib/zones.ts), puis les tranches voisines de
 * même zone fusionnées. Fonction pure (tests : tools/test-zone-ribbon.ts) ; stockée dans Activity.zoneRibbon à l'import.
 */
import { bounds, HR_PCT, POWER_PCT, zoneIndex } from "../zones";

export const RIBBON_BUCKETS = 40;
/** En dessous, une série est trop courte pour un ruban lisible. */
const MIN_SECONDS = 60;
/** Part minimale de tranches avec mesure (FC) pour oser un ruban : au-delà de 50 % de trous, on préfère ne rien dire. */
const MIN_COVERAGE = 0.5;

export type RibbonZone = 1 | 2 | 3 | 4 | 5 | 6;
/** Un tronçon du ruban : zone, et fraction du temps total (la somme vaut 1). */
export type RibbonSegment = { z: RibbonZone; f: number };

/** Séries à 1 Hz de lib/stream.ts (0 = pas de mesure) ; seules `hr` et `power` servent. */
export type RibbonStream = { hr?: number[]; power?: number[] };
export type RibbonRefs = { hrMax?: number | null; ftp?: number | null };

/** Zone (0 à 5) de la moyenne de chaque tranche ; null = tranche sans mesure. */
function bucketZones(series: number[], upper: number[], keepZeros: boolean): (number | null)[] {
  const n = series.length, out: (number | null)[] = [];
  for (let i = 0; i < RIBBON_BUCKETS; i++) {
    const from = Math.floor((i * n) / RIBBON_BUCKETS), to = Math.floor(((i + 1) * n) / RIBBON_BUCKETS);
    let sum = 0, count = 0;
    for (let k = from; k < to; k++) {
      const v = series[k];
      if (keepZeros || v > 0) { sum += v; count++; }
    }
    // Puissance : un zéro est un vrai zéro (roue libre, arrêt) → Z1 ; FC : un zéro est un trou de capteur, ignoré.
    out.push(count ? zoneIndex(sum / count, upper) : null);
  }
  return out;
}

/** Complète les tranches sans mesure avec la voisine précédente (la première mesurée pour les tranches du début). */
function fill(zones: (number | null)[]): number[] | null {
  const first = zones.findIndex((z) => z != null);
  if (first < 0 || zones.filter((z) => z != null).length / zones.length < MIN_COVERAGE) return null;
  const out: number[] = [];
  let last = zones[first]!;
  for (const z of zones) { if (z != null) last = z; out.push(last); }
  return out;
}

/** Fusionne les tranches voisines de même zone. */
function merge(zones: number[]): RibbonSegment[] {
  const out: RibbonSegment[] = [];
  let run = 0;
  for (let i = 0; i < zones.length; i++) {
    run++;
    if (i === zones.length - 1 || zones[i + 1] !== zones[i]) {
      out.push({ z: (zones[i] + 1) as RibbonZone, f: run / zones.length });
      run = 0;
    }
  }
  return out;
}

/**
 * Ruban d'une activité : la FC d'abord (avec la FC max), la puissance pour le vélo quand il n'y a pas de FC exploitable (avec la FTP).
 * Null sans série ni seuil utilisable.
 */
export function zoneRibbon(stream: RibbonStream, refs: RibbonRefs, opts: { ride?: boolean } = {}): RibbonSegment[] | null {
  const { hr = [], power = [] } = stream;
  if (hr.length >= MIN_SECONDS && refs.hrMax && refs.hrMax > 0) {
    const zones = fill(bucketZones(hr, bounds(refs.hrMax, HR_PCT), false));
    if (zones) return merge(zones);
  }
  if (opts.ride && power.length >= MIN_SECONDS && refs.ftp && refs.ftp > 0) {
    const zones = fill(bucketZones(power, bounds(refs.ftp, POWER_PCT), true));
    if (zones) return merge(zones);
  }
  return null;
}

/** Relit un ruban stocké (JSON) : null si la forme n'est pas bonne. */
export function parseRibbon(raw: unknown): RibbonSegment[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: RibbonSegment[] = [];
  for (const s of raw as { z?: unknown; f?: unknown }[]) {
    if (!s || typeof s.z !== "number" || !Number.isInteger(s.z) || s.z < 1 || s.z > 6 || typeof s.f !== "number" || !(s.f > 0)) return null;
    out.push({ z: s.z as RibbonZone, f: s.f });
  }
  return out;
}
