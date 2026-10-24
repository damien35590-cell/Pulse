/**
 * Ruban de zones d'une activité (art, voir docs/design-system.md règle 8) : la séance découpée en ~40 tranches de durée égale,
 * chacune classée dans la zone de sa valeur moyenne (mêmes bornes que TraceChart / ZoneBar : lib/zones.ts), puis les tranches voisines de
 * même zone fusionnées. Fonction pure (tests : tools/test-zone-ribbon.ts) ; stockée dans Activity.zoneRibbon à l'import.
 * Source, par priorité : FC (FC max) > puissance (vélo, FTP) > allure (course, VMA).
 */
import { bounds, HR_PCT, POWER_PCT, zoneIndex } from "../zones";
import { detectIntervals, toSlots, type IntervalResult } from "./interval";
import { PACE_PCT, paceSeries, type PacePoint } from "./pace";

export const RIBBON_BUCKETS = 40;
/** En dessous, une série est trop courte pour un ruban lisible. */
const MIN_SECONDS = 60;
/** Part minimale de tranches avec mesure (FC) pour oser un ruban : au-delà de 50 % de trous, on préfère ne rien dire. */
const MIN_COVERAGE = 0.5;

export type RibbonZone = 1 | 2 | 3 | 4 | 5 | 6;
/** Un tronçon du ruban : zone, et fraction du temps total (la somme vaut 1). */
export type RibbonSegment = { z: RibbonZone; f: number };
/** D'où vient le ruban (Activity.zoneRibbonSource). */
export type RibbonSource = "hr" | "power" | "pace";

/** Séries à 1 Hz de lib/stream.ts (0 = pas de mesure) et trace GPS (course, pour l'allure). */
export type RibbonStream = { hr?: number[]; power?: number[]; points?: PacePoint[] };
/** Seuils : FC max (bpm), FTP (W), VMA (km/h). */
export type RibbonRefs = { hrMax?: number | null; ftp?: number | null; vma?: number | null };
export type RibbonOpts = { ride?: boolean; run?: boolean };
/** `ref` : le seuil qui a servi, gardé avec le ruban pour savoir quand il est périmé. */
export type Ribbon = { segments: RibbonSegment[]; source: RibbonSource; ref: number; interval?: IntervalResult };

/** Bornes hautes de Z1 à Z5 en km/h (pas de bounds() : il arrondit à l'entier, trop grossier). */
export const paceUpper = (vma: number) => PACE_PCT.map((p) => (vma * p) / 100);

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
    // Puissance : un zéro est un vrai zéro (roue libre, arrêt) → Z1 ; FC : un zéro est un trou de capteur, ignoré ; allure : un zéro est un arrêt, ignoré.
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
 * Ruban d'une activité : la FC d'abord (avec la FC max), la puissance pour le vélo quand il n'y a pas de FC exploitable (avec la FTP),
 * l'allure pour la course sans FC exploitable (avec la VMA, zones en % de la VMA). Null sans série ni seuil utilisable.
 */
export function zoneRibbon(stream: RibbonStream, refs: RibbonRefs, opts: RibbonOpts = {}): Ribbon | null {
  const { hr = [], power = [], points = [] } = stream;
  if (hr.length >= MIN_SECONDS && refs.hrMax && refs.hrMax > 0) {
    const zones = fill(bucketZones(hr, bounds(refs.hrMax, HR_PCT), false));
    if (zones) return { segments: merge(zones), source: "hr", ref: refs.hrMax, interval: detectIntervals(toSlots(hr), bounds(refs.hrMax, HR_PCT)) };
  }
  if (opts.ride && power.length >= MIN_SECONDS && refs.ftp && refs.ftp > 0) {
    const zones = fill(bucketZones(power, bounds(refs.ftp, POWER_PCT), true));
    if (zones) return { segments: merge(zones), source: "power", ref: refs.ftp };
  }
  if (opts.run && points.length >= 2 && refs.vma && refs.vma > 0) {
    const speed = paceSeries(points);
    // Pas de bounds() ici : il arrondit à l'entier, trop grossier pour des km/h.
    const zones = speed.length >= MIN_SECONDS ? fill(bucketZones(speed, paceUpper(refs.vma), false)) : null;
    if (zones) return { segments: merge(zones), source: "pace", ref: refs.vma, interval: detectIntervals(toSlots(speed), paceUpper(refs.vma)) };
  }
  return null;
}

/** Variation d'un seuil qui rend un ruban périmé : FC max ≥ 2 bpm, FTP ≥ 2 W, VMA au moindre changement (elle se saisit au dixième). */
export const REF_TOLERANCE: Record<RibbonSource, number> = { hr: 2, power: 2, pace: 0.05 };
const REF_KEY: Record<RibbonSource, keyof RibbonRefs> = { hr: "hrMax", power: "ftp", pace: "vma" };

/**
 * Compare deux jeux de seuils. `stale` : sources dont le seuil a bougé (rubans à recalculer) ;
 * `appeared` : un seuil est apparu, des activités restées sans ruban faute de seuil deviennent calculables.
 */
export function refsChange(before: RibbonRefs, after: RibbonRefs): { stale: RibbonSource[]; appeared: boolean } {
  const stale: RibbonSource[] = [];
  let appeared = false;
  for (const s of Object.keys(REF_KEY) as RibbonSource[]) {
    const a = before[REF_KEY[s]] ?? null, b = after[REF_KEY[s]] ?? null;
    if (a == null && b == null) continue;
    if (a == null) appeared = true;
    if (a == null || b == null || Math.abs(a - b) >= REF_TOLERANCE[s]) stale.push(s);
  }
  return { stale, appeared };
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
