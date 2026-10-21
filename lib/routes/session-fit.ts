/**
 * Boucles adaptées au type de séance course : fractionné (ligne droite plate), sortie longue (points d'eau),
 * récupération (plat, nature, peu de routes). Fonctions pures, sans dépendance (tests : tools/test-session.ts).
 * Toutes les constantes réglables sont ici.
 */
import type { PoiType } from "./poi";

export type RunSession = "normal" | "intervals" | "long" | "easy";
export const RUN_SESSIONS: readonly RunSession[] = ["normal", "intervals", "long", "easy"];

/** Libellés courts (sélecteur des Itinéraires) et nom du choix en tête des 3 boucles. */
export const SESSION_LABEL: Record<RunSession, string> = { normal: "Normale", intervals: "Fractionné", long: "Sortie longue", easy: "Récup" };
export const SESSION_PICK: Record<Exclude<RunSession, "normal">, string> = {
  intervals: "Pour le fractionné", long: "Pour la sortie longue", easy: "Pour la récup",
};

/** `?session=intervals|long|easy` (ou corps JSON) → séance ; tout le reste = séance normale. */
export function parseSession(v: unknown): RunSession {
  return v === "intervals" || v === "long" || v === "easy" ? v : "normal";
}

// ───────── Type de séance d'après le programme ─────────
/** SessionKind Prisma → type de séance pour les boucles (côtes, fartlek, allure progressive : boucle normale). */
const KIND_SESSION: Record<string, RunSession> = {
  INTERVALS_SHORT: "intervals", INTERVALS_LONG: "intervals", THRESHOLD: "intervals", VMA_TEST: "intervals", RACE_PACE: "intervals",
  LONG_RUN: "long",
  EASY: "easy", RECOVERY: "easy",
  HILLS: "normal", FARTLEK: "normal", PROGRESSIVE: "normal", RACE: "normal", // les côtes veulent du dénivelé, pas du plat
};

/**
 * Type de séance d'une séance du programme : d'abord son genre (kind) s'il est connu, sinon son titre et son résumé
 * (« Fractionné », « VMA courte · 8 × 400 m », « Seuil », « Sortie longue », « Footing », « Récup »).
 * « normal » : séance connue qui ne demande rien de particulier (côtes…) ; null : rien de reconnaissable.
 */
export function sessionFromProgram(s: { kind?: string | null; title: string; summary?: string | null }): RunSession | null {
  if (s.kind && KIND_SESSION[s.kind]) return KIND_SESSION[s.kind];
  // Le titre d'abord : le résumé d'un footing parle aussi d'allure (« 45′ à 6'10 /km »), parfois de VMA.
  const title = s.title.toLowerCase(), summary = (s.summary ?? "").toLowerCase();
  if (/sortie longue/.test(title)) return "long";
  if (/fractionn|vma|interval|seuil|\d+\s*[×x]\s*\d+|\d+\s*\/\s*\d+/.test(title)) return "intervals";
  if (/footing|r[ée]cup|endurance|souple|facile/.test(title)) return "easy";
  if (/\d+\s*×\s*\d+/.test(summary)) return "intervals"; // « 8 × 400 m à 4'05 /km (r 1'15) »
  return null;
}

// ───────── Réglages ─────────
/** Pas du rééchantillonnage du tracé (m). */
export const STEP_M = 25;
/** Lissage de l'altitude (m de part et d'autre) : le modèle d'altitude d'ORS est bruité de quelques mètres. */
const ELE_SMOOTH_M = 75;
/** Fractionné : longueur minimale d'une ligne droite plate, et longueur qui donne le plein score. */
export const STRAIGHT_MIN_M = 400;
export const STRAIGHT_FULL_M = 1000;
/** Droite : longueur à vol d'oiseau ≥ 97 % de la longueur parcourue… */
export const STRAIGHT_RATIO = 0.97;
/** … et écart à la corde ≤ 4 % de la longueur (12 m au moins, 40 m au plus). */
const DEV_PCT = 0.04, DEV_MIN_M = 12, DEV_MAX_M = 40;
/** … et dont les extrémités ne s'écartent pas de plus de 25° de la direction de la portion (pas de virage compris). */
const END_COS = Math.cos((25 * Math.PI) / 180);
/** Plate : altitude (lissée) qui varie de moins de 1,2 % de la longueur (5 m au moins) sur toute la portion. */
export const FLAT_RANGE_PCT = 0.012;
const FLAT_RANGE_MIN_M = 5;
/** Une portion qui suit une grande route (waytype ORS) sur plus de 25 % n'est pas retenue (circulation, carrefours). */
const STRAIGHT_MAX_BIG_ROAD = 0.25;
/** Récup : pente (lissée sur 100 m) sous laquelle un pas compte comme plat. */
export const FLAT_GRADE = 0.025;
/** Récup : D+ par km plein score / score nul. */
const EASY_CLIMB_OK = 5, EASY_CLIMB_MAX = 20;
/** Sortie longue : au-delà de 75 min sans point d'eau (départ et arrivée comptent comme eau), la boucle est pénalisée. */
export const LONG_DRY_MIN = 75;
/** Pénalité pleine à 75 + 20 min sans eau. */
const LONG_DRY_FULL_MIN = 20;

// ───────── Géométrie ─────────
export type Pt3 = [number, number, number]; // [lat, lng, ele]
type R = { x: number; y: number; ele: number; d: number };

/** Distances cumulées (m) le long du tracé, en projection locale. */
export function cumulative(coords: Pt3[]) {
  const kx = 111_320 * Math.cos(((coords[0]?.[0] ?? 0) * Math.PI) / 180), out = [0];
  for (let i = 1; i < coords.length; i++) {
    out.push(out[i - 1] + Math.hypot((coords[i][1] - coords[i - 1][1]) * kx, (coords[i][0] - coords[i - 1][0]) * 110_540));
  }
  return out;
}

/** Un point tous les `step` mètres le long du tracé (x, y en m, altitude interpolée puis lissée, d = distance cumulée). */
export function resample(coords: Pt3[], step = STEP_M): R[] {
  if (coords.length < 2) return [];
  const kx = 111_320 * Math.cos((coords[0][0] * Math.PI) / 180), cum = cumulative(coords), total = cum.at(-1)!;
  const out: R[] = [];
  let k = 1;
  for (let d = 0; d <= total + 1e-6; d += step) {
    while (k < coords.length - 1 && cum[k] < d) k++;
    const a = coords[k - 1], b = coords[k], seg = cum[k] - cum[k - 1], t = seg ? Math.min(1, Math.max(0, (d - cum[k - 1]) / seg)) : 0;
    const lat = a[0] + t * (b[0] - a[0]), lng = a[1] + t * (b[1] - a[1]);
    out.push({ x: lng * kx, y: lat * 110_540, ele: a[2] + t * (b[2] - a[2]), d });
  }
  // Lissage de l'altitude : moyenne glissante sur ±75 m.
  const w = Math.max(1, Math.round(ELE_SMOOTH_M / step)), raw = out.map((p) => p.ele);
  for (let i = 0; i < out.length; i++) {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(out.length - 1, i + w); j++) { s += raw[j]; n++; }
    out[i].ele = s / n;
  }
  return out;
}

/** Plages d'indices de coordonnées [de, à] → mêmes plages sur le tracé parcouru à l'envers. */
export const reverseSpans = (spans: [number, number][], n: number): [number, number][] =>
  spans.map(([a, b]) => [n - 1 - b, n - 1 - a] as [number, number]).reverse();

// ───────── Fractionné : lignes droites plates ─────────
export type Stretch = { fromKm: number; toKm: number; lengthM: number; /** pente moyenne signée (%) dans le sens du tracé */ gradePct: number };

/**
 * Portions droites et plates d'au moins `minM` mètres, sans recouvrement, de la plus longue à la plus courte (3 au plus).
 * `bigRoadSpans` : plages d'indices de `coords` sur grande route (waytype ORS 1-2), écartées si elles couvrent > 25 % de la portion.
 */
export function straightStretches(coords: Pt3[], opts: { minM?: number; bigRoadSpans?: [number, number][] } = {}): Stretch[] {
  const minM = opts.minM ?? STRAIGHT_MIN_M, p = resample(coords);
  if (p.length < 3) return [];
  const cum = cumulative(coords);
  const big = (opts.bigRoadSpans ?? []).map(([a, b]) => [cum[Math.max(0, a)] ?? 0, cum[Math.min(cum.length - 1, b)] ?? 0] as const).filter(([a, b]) => b > a);
  const bigShare = (from: number, to: number) => {
    let hit = 0;
    for (const [a, b] of big) hit += Math.max(0, Math.min(b, to) - Math.max(a, from));
    return to > from ? hit / (to - from) : 0;
  };

  const valid = (i: number, j: number) => {
    const len = p[j].d - p[i].d;
    if (len <= 0) return false;
    const cx = p[j].x - p[i].x, cy = p[j].y - p[i].y, chord = Math.hypot(cx, cy);
    if (chord < STRAIGHT_RATIO * len) return false;
    // Les 50 premiers et derniers mètres vont dans le sens de la portion : un virage à l'une des extrémités n'en fait pas partie.
    if (j - i >= 4) {
      const ends: [number, number][] = [[i, i + 2], [j - 2, j]];
      for (const [a, b] of ends) {
        const sx = p[b].x - p[a].x, sy = p[b].y - p[a].y, sl = Math.hypot(sx, sy);
        if (sl && (sx * cx + sy * cy) / (sl * chord) < END_COS) return false;
      }
    }
    const maxDev = Math.min(DEV_MAX_M, Math.max(DEV_MIN_M, DEV_PCT * len));
    let lo = Infinity, hi = -Infinity;
    for (let k = i; k <= j; k++) {
      if (k > i && k < j && Math.abs((p[k].x - p[i].x) * cy - (p[k].y - p[i].y) * cx) / chord > maxDev) return false;
      lo = Math.min(lo, p[k].ele); hi = Math.max(hi, p[k].ele);
    }
    return hi - lo <= Math.max(FLAT_RANGE_MIN_M, FLAT_RANGE_PCT * len);
  };

  // Fenêtre glissante : pour chaque début, on pousse la fin tant que la portion reste droite et plate.
  const found: { i: number; j: number; len: number }[] = [];
  let j = 1;
  for (let i = 0; i < p.length - 1; i++) {
    if (j <= i) j = i + 1;
    while (j + 1 < p.length && valid(i, j + 1)) j++;
    const len = p[j].d - p[i].d;
    if (len >= minM && valid(i, j) && bigShare(p[i].d, p[j].d) <= STRAIGHT_MAX_BIG_ROAD) found.push({ i, j, len });
  }

  // Les plus longues d'abord, sans recouvrement.
  const out: { i: number; j: number; len: number }[] = [];
  for (const f of found.sort((a, b) => b.len - a.len)) {
    if (out.length >= 3) break;
    if (out.every((o) => f.j <= o.i || f.i >= o.j)) out.push(f);
  }
  return out.map(({ i, j, len }) => ({
    fromKm: Math.round(p[i].d / 100) / 10, toKm: Math.round(p[j].d / 100) / 10, lengthM: Math.round(len / 10) * 10,
    gradePct: Math.round(((p[j].ele - p[i].ele) / len) * 1000) / 10,
  }));
}

// ───────── Récup : planéité ─────────
/** Part de la distance (0 → 1) où la pente lissée sur 100 m reste sous 2,5 %. */
export function flatShare(coords: Pt3[]) {
  const p = resample(coords), h = Math.max(1, Math.round(50 / STEP_M));
  if (p.length < 2) return 1;
  let flat = 0;
  for (let i = 1; i < p.length; i++) {
    const a = p[Math.max(0, i - h)], b = p[Math.min(p.length - 1, i + h)];
    if (b.d > a.d && Math.abs(b.ele - a.ele) / (b.d - a.d) < FLAT_GRADE) flat++;
  }
  return flat / (p.length - 1);
}

// ───────── Sortie longue : points d'eau ─────────
export type WaterStop = { km: number; cemetery: boolean };

/**
 * Points d'eau sur la boucle (eau potable, et robinets probables des cimetières), et plus longue durée sans eau,
 * départ et arrivée comptant comme eau (la maison, la voiture).
 */
export function waterPlan(pois: { type: PoiType; km: number }[], distanceKm: number, estMinutes: number) {
  const stops: WaterStop[] = pois
    .filter((x) => x.type === "drinking_water" || x.type === "cemetery")
    .map((x) => ({ km: x.km, cemetery: x.type === "cemetery" }))
    .sort((a, b) => a.km - b.km);
  const marks = [0, ...stops.map((s) => Math.min(distanceKm, Math.max(0, s.km))), distanceKm];
  let gapKm = 0;
  for (let i = 1; i < marks.length; i++) gapKm = Math.max(gapKm, marks[i] - marks[i - 1]);
  const maxDryMin = distanceKm > 0 ? (gapKm / distanceKm) * estMinutes : estMinutes;
  return { stops, drinking: stops.filter((s) => !s.cemetery).length, cemeteries: stops.filter((s) => s.cemetery).length, maxDryMin: Math.round(maxDryMin) };
}

// ───────── Note de séance ─────────
export type SessionInput = {
  coords: Pt3[]; distanceM: number; ascentM: number; estMinutes: number;
  /** Plages d'indices de `coords` sur grande route (waytype ORS), absentes pour une trace GPS. */
  bigRoadSpans?: [number, number][];
  pois: { type: PoiType; km: number }[];
  /** Notes déjà calculées (lib/routes/score.ts) : part en nature, non revêtue, sur grandes routes. */
  nature: number; unpaved: number; bigRoad: number;
};

/** Résumé enregistré avec la boucle (scores.session). */
export type SessionScores = {
  type: Exclude<RunSession, "normal">;
  ok: boolean;
  bonus: number;
  straight?: Stretch[];
  water?: { drinking: number; cemeteries: number; maxDryMin: number; km: number[] };
  flatPct?: number;
  climbPerKm?: number;
};

export type SessionFit = {
  /** La boucle convient-elle à la séance ? (fractionné : une ligne droite plate d'au moins 400 m) */
  ok: boolean;
  /** Ajouté au score global (≈ -0,35 → +0,5). */
  bonus: number;
  /** Clé de tri du choix « Pour le fractionné / la sortie longue / la récup » (0 → 1). */
  key: number;
  /** Atout séance pour la phrase « pourquoi ». */
  text: string;
  scores: SessionScores;
};

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r3 = (x: number) => Math.round(x * 1000) / 1000;
/** 2.1 → « 2,1 » ; 14 → « 14 » */
export const fmtKm = (km: number) => String(Math.round(km * 10) / 10).replace(".", ",");
/** 95 → « 1 h 35 » ; 50 → « 50 min » */
export const fmtDuration = (min: number) => {
  const m = Math.round(min);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
};

/** « Ligne droite plate de 850 m au km 2,1 (et 500 m au km 6,3) » */
export function straightText(st: Stretch[]) {
  if (!st.length) return `Pas de ligne droite plate de ${STRAIGHT_MIN_M} m : fais tes fractions au temps`;
  const [a, b] = st, at = (s: Stretch) => (s.fromKm < 0.1 ? "dès le départ" : `au km ${fmtKm(s.fromKm)}`);
  return `Ligne droite plate de ${a.lengthM} m ${at(a)}${b ? ` (et ${b.lengthM} m ${at(b)})` : ""}`;
}

/** « Points d'eau : km 4,2 ; 9,8 (cimetière) ; 14 » · « Aucun point d'eau sur 1 h 30 : emporte à boire » */
export function waterText(w: ReturnType<typeof waterPlan>, estMinutes: number) {
  if (!w.stops.length) {
    return estMinutes > LONG_DRY_MIN ? `Aucun point d'eau sur ${fmtDuration(estMinutes)} : emporte à boire` : "Pas de point d'eau (sortie courte, ça passe)";
  }
  const one = w.stops[0];
  const head = w.stops.length === 1
    ? `${one.cemetery ? "Robinet de cimetière" : "Point d'eau"} au km ${fmtKm(one.km)}`
    : `Points d'eau : km ${w.stops.slice(0, 4).map((s) => `${fmtKm(s.km)}${s.cemetery ? " (cimetière)" : ""}`).join(" ; ")}`;
  return w.maxDryMin > LONG_DRY_MIN ? `${head} · jusqu'à ${fmtDuration(w.maxDryMin)} sans eau` : head;
}

/** Note d'une boucle pour la séance : null pour une séance normale (classement inchangé). */
export function sessionFit(session: RunSession, r: SessionInput): SessionFit | null {
  if (session === "normal" || r.coords.length < 2) return null;
  const km = r.distanceM / 1000;

  if (session === "intervals") {
    const st = straightStretches(r.coords, { bigRoadSpans: r.bigRoadSpans });
    const best = st[0]?.lengthM ?? 0, ok = best >= STRAIGHT_MIN_M;
    const key = clamp01(best / STRAIGHT_FULL_M);
    // 400 m = +0,2 ; 1 km ou plus = +0,5 ; rien = -0,3 (une boucle sans ligne droite ne sert pas la séance).
    const bonus = ok ? 0.2 + 0.3 * clamp01((best - STRAIGHT_MIN_M) / (STRAIGHT_FULL_M - STRAIGHT_MIN_M)) : -0.3;
    return { ok, bonus: r3(bonus), key: r3(key), text: straightText(st), scores: { type: "intervals", ok, bonus: r3(bonus), straight: st } };
  }

  if (session === "long") {
    const w = waterPlan(r.pois, km, r.estMinutes);
    const supply = clamp01((w.drinking + 0.5 * w.cemeteries) / 2); // 2 vrais points d'eau = plein score
    const dry = r.estMinutes > LONG_DRY_MIN ? clamp01((w.maxDryMin - LONG_DRY_MIN) / LONG_DRY_FULL_MIN) : 0;
    const bonus = 0.15 * supply - 0.35 * dry;
    return {
      ok: dry < 1, bonus: r3(bonus), key: r3(clamp01(0.5 + supply * 0.5 - dry * 0.5)), text: waterText(w, r.estMinutes),
      scores: { type: "long", ok: dry < 1, bonus: r3(bonus), water: { drinking: w.drinking, cemeteries: w.cemeteries, maxDryMin: w.maxDryMin, km: w.stops.map((s) => s.km) } },
    };
  }

  // Récup : plat (part plate et D+/km), nature ou chemins, peu de grandes routes.
  const flat = flatShare(r.coords), climb = km > 0 ? r.ascentM / km : 0;
  const flatScore = 0.5 * flat + 0.5 * clamp01(1 - (climb - EASY_CLIMB_OK) / (EASY_CLIMB_MAX - EASY_CLIMB_OK));
  const green = clamp01(r.nature + 0.5 * r.unpaved * (1 - r.nature));
  const bonus = 0.25 * flatScore + 0.2 * green - 0.4 * r.bigRoad;
  const key = clamp01(0.5 * flatScore + 0.35 * green + 0.15 * (1 - Math.min(1, r.bigRoad * 3)));
  const climbR = Math.round(climb);
  const text = [`${Math.round(flat * 100)} % plat`, `${climbR} m D+/km`, r.bigRoad < 0.05 ? "quasi sans grandes routes" : null].filter(Boolean).join(", ");
  return {
    ok: true, bonus: r3(bonus), key: r3(key), text: text.charAt(0).toUpperCase() + text.slice(1),
    scores: { type: "easy", ok: true, bonus: r3(bonus), flatPct: Math.round(flat * 100), climbPerKm: climbR },
  };
}
