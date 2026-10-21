/**
 * Notation des boucles avec les données OpenStreetMap, puis choix de 3 boucles différentes.
 * Échantillonnage tous les 50 m (@turf), distances en projection locale (précise à l'échelle d'une boucle).
 */
import along from "@turf/along";
import length from "@turf/length";
import { lineString } from "@turf/helpers";
import type { RouteSport } from "./estimate";
import { timeError, TIME_TOLERANCE } from "./estimate";
import type { NatureKind, OsmData, Pt, RouteKind } from "./overpass";
import { isWaterPoi, poiLabel, type PoiType, type RoutePoi } from "./poi";
import type { SessionScores } from "./session-fit";

/** Réglages de la notation. */
const SAMPLE_M = 50;
const NATURE_NEAR_M = 50;
const POI_NEAR_M = 75;
const MARKED_NEAR_M = 20;
const OVERLAP_NEAR_M = 30;
export const MAX_OVERLAP = 0.6;
const CELL_M = 100; // maille de l'index spatial (≥ plus grand rayon de recherche par point d'échantillon)

export type RouteScores = {
  /** 0 → 1 : part du tracé en nature ou à moins de 50 m. */
  nature: number;
  /** Part du tracé par type de nature (une même portion peut compter pour deux types). */
  kinds: Record<NatureKind, number>;
  poiCount: number;
  marked: number;
  bigRoad: number;
  unpaved: number;
  waterPoints: number;
  timeError: number;
  global: number;
  /** false : OpenStreetMap n'a pas répondu, seules les données ORS comptent. */
  osm: boolean;
  /** Bonus ou malus météo déjà compris dans `global` (lib/weather/rules.ts). Absent sans météo. */
  weather?: number;
  /** Part du tracé sur voie éclairée, cherchée seulement quand la sortie finit de nuit. */
  lit?: number | null;
  /** Part du tracé sur tes chemins habituels (lib/habits), absente sans trace GPS. */
  familiar?: number;
  /** Atout pour la séance demandée (fractionné, sortie longue, récup) ; bonus déjà compris dans `global`. */
  session?: SessionScores;
};

export type ScoreInput = { coords: [number, number, number][]; distanceM: number; estMinutes: number; bigRoadPct: number; unpavedPct: number };

// ───────── Projection locale et index spatial de segments ─────────
type Proj = { x: (lat: number, lng: number) => number; y: (lat: number) => number };
export const projection = (lat0: number): Proj => {
  const kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  return { x: (_lat, lng) => lng * kx, y: (lat) => lat * 110_540 };
};

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return { d: Math.hypot(px - ax - t * dx, py - ay - t * dy), t };
}

/** Segments rangés dans une grille : « quels segments à moins de r mètres de ce point ? » sans tout parcourir. */
export class SegIndex {
  private segs: number[] = []; // x1, y1, x2, y2, propriétaire, n° du segment dans la ligne
  private grid = new Map<string, number[]>();
  constructor(private p: Proj, private cell = CELL_M) {}
  add(line: Pt[], owner: number) {
    for (let i = 1; i < line.length; i++) {
      const ax = this.p.x(line[i - 1][0], line[i - 1][1]), ay = this.p.y(line[i - 1][0]);
      const bx = this.p.x(line[i][0], line[i][1]), by = this.p.y(line[i][0]);
      const k = this.segs.length / 6;
      this.segs.push(ax, ay, bx, by, owner, i - 1);
      const [cx0, cx1] = [Math.floor(Math.min(ax, bx) / this.cell), Math.floor(Math.max(ax, bx) / this.cell)];
      const [cy0, cy1] = [Math.floor(Math.min(ay, by) / this.cell), Math.floor(Math.max(ay, by) / this.cell)];
      if ((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > 2500) continue; // segment aberrant (> 5 km) : ignoré
      for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
        const key = `${cx}:${cy}`, list = this.grid.get(key);
        if (list) list.push(k); else this.grid.set(key, [k]);
      }
    }
    return this;
  }
  /** Propriétaires des segments à moins de r mètres (r ≤ maille). */
  near(lat: number, lng: number, r: number) {
    const x = this.p.x(lat, lng), y = this.p.y(lat), cx = Math.floor(x / this.cell), cy = Math.floor(y / this.cell), out = new Set<number>(), s = this.segs;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      for (const k of this.grid.get(`${cx + i}:${cy + j}`) ?? []) {
        const o = k * 6;
        if (!out.has(s[o + 4]) && segDist(x, y, s[o], s[o + 1], s[o + 2], s[o + 3]).d <= r) out.add(s[o + 4]);
      }
    }
    return out;
  }
}

/** Polygone (règle pair-impair sur tous ses segments) : marche aussi pour un multipolygone dont les anneaux ne sont pas assemblés. */
function inside(lat: number, lng: number, lines: Pt[][]) {
  let c = false;
  for (const l of lines) for (let i = 1; i < l.length; i++) {
    const [y1, x1] = l[i - 1], [y2, x2] = l[i];
    if ((y1 > lat) !== (y2 > lat) && lng < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}

// ───────── Échantillonnage ─────────
export type Sample = { lat: number; lng: number; km: number };

/** Un point tous les 50 m le long du tracé (départ et arrivée compris). */
export function sampleRoute(coords: [number, number, number][], step = SAMPLE_M): Sample[] {
  const line = lineString(coords.map(([lat, lng]) => [lng, lat]));
  const total = length(line, { units: "meters" }), out: Sample[] = [];
  for (let d = 0; d <= total; d += step) {
    const [lng, lat] = along(line, d, { units: "meters" }).geometry.coordinates;
    out.push({ lat, lng, km: d / 1000 });
  }
  return out;
}

const bboxOf = (pts: { lat: number; lng: number }[]) => ({
  s: Math.min(...pts.map((p) => p.lat)), n: Math.max(...pts.map((p) => p.lat)),
  w: Math.min(...pts.map((p) => p.lng)), e: Math.max(...pts.map((p) => p.lng)),
});

/** Emprise de plusieurs tracés, élargie de `marginM` mètres. */
export function bboxOfRoutes(routes: [number, number, number][][], marginM = 150) {
  const pts = routes.flatMap((c) => c.map(([lat, lng]) => ({ lat, lng })));
  const b = bboxOf(pts), dLat = marginM / 110_540, dLng = marginM / (111_320 * Math.cos((((b.s + b.n) / 2) * Math.PI) / 180));
  return { s: b.s - dLat, n: b.n + dLat, w: b.w - dLng, e: b.e + dLng };
}

// ───────── Index des données OSM ─────────
type AreaRef = { f: number; box: { s: number; n: number; w: number; e: number } };

export type OsmIndex = {
  proj: Proj;
  data: OsmData;
  natureLines: SegIndex;
  areas: AreaRef[];
  marked: Partial<Record<RouteKind, SegIndex>>;
};

export function indexOsm(data: OsmData, lat0: number): OsmIndex {
  const proj = projection(lat0), natureLines = new SegIndex(proj), areas: AreaRef[] = [];
  data.nature.forEach((f, i) => {
    f.lines.forEach((l) => natureLines.add(l, i));
    if (f.area) areas.push({ f: i, box: bboxOf(f.lines.flat().map(([lat, lng]) => ({ lat, lng }))) });
  });
  const marked: OsmIndex["marked"] = {};
  data.routes.forEach((r, i) => { const idx = (marked[r.k] ??= new SegIndex(proj)); r.lines.forEach((l) => idx.add(l, i)); });
  return { proj, data, natureLines, areas, marked };
}

/** Itinéraires balisés qui comptent pour ce sport. */
const markedKind = (sport: RouteSport): RouteKind => (sport === "RUN" ? "foot" : "bike");

// ───────── Notation d'une boucle ─────────
export type Scored<T> = T & { samples: Sample[]; scores: RouteScores; pois: RoutePoi[] };

export function scoreRoute<T extends ScoreInput>(c: T, idx: OsmIndex | null, sport: RouteSport, target: number): Scored<T> {
  const samples = sampleRoute(c.coords);
  const kindsHit: Record<NatureKind, number> = { forest: 0, water: 0, heath: 0, park: 0 };
  let natureN = 0, markedN = 0;
  const pois: RoutePoi[] = [];

  if (idx) {
    const nat = idx.data.nature, mk = idx.marked[markedKind(sport)];
    for (const s of samples) {
      const kinds = new Set<NatureKind>();
      for (const f of idx.natureLines.near(s.lat, s.lng, NATURE_NEAR_M)) kinds.add(nat[f].k);
      for (const a of idx.areas) {
        if (kinds.has(nat[a.f].k)) continue;
        if (s.lat >= a.box.s && s.lat <= a.box.n && s.lng >= a.box.w && s.lng <= a.box.e && inside(s.lat, s.lng, nat[a.f].lines)) kinds.add(nat[a.f].k);
      }
      if (kinds.size) natureN++;
      kinds.forEach((k) => kindsHit[k]++);
      if (mk && mk.near(s.lat, s.lng, MARKED_NEAR_M).size) markedN++;
    }

    // Points d'intérêt : distance au tracé réel (pas aux échantillons), position en km le long de la boucle.
    const p = idx.proj, pts = c.coords.map(([lat, lng]) => [p.x(lat, lng), p.y(lat)] as const);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const box = bboxOfRoutes([c.coords], POI_NEAR_M + 10);
    for (const poi of idx.data.pois) {
      if (poi.lat < box.s || poi.lat > box.n || poi.lng < box.w || poi.lng > box.e) continue;
      const x = p.x(poi.lat, poi.lng), y = p.y(poi.lat);
      let best = Infinity, at = 0;
      for (let i = 1; i < pts.length; i++) {
        const { d, t } = segDist(x, y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]);
        if (d < best) { best = d; at = cum[i - 1] + t * (cum[i] - cum[i - 1]); }
      }
      if (best <= POI_NEAR_M) pois.push({ id: poi.id, name: poi.n ?? null, type: poi.t, lat: poi.lat, lng: poi.lng, km: Math.round(at / 100) / 10 });
    }
    pois.sort((a, b) => a.km - b.km);
    // Même lieu cartographié deux fois (point + contour) : un seul point d'intérêt.
    for (let i = pois.length - 1; i > 0; i--) {
      const a = pois[i], b = pois.slice(0, i).find((b) => b.type === a.type && Math.hypot(p.x(a.lat, a.lng) - p.x(b.lat, b.lng), p.y(a.lat) - p.y(b.lat)) < 30);
      if (b) { b.name ??= a.name; pois.splice(i, 1); }
    }
  }

  const n = samples.length || 1;
  const poiCount = pois.filter((x) => !isWaterPoi(x.type)).length;
  const waterPoints = pois.filter((x) => x.type === "drinking_water").length;
  const err = timeError(c.estMinutes, target);
  const scores: RouteScores = {
    nature: natureN / n,
    kinds: { forest: kindsHit.forest / n, water: kindsHit.water / n, heath: kindsHit.heath / n, park: kindsHit.park / n },
    poiCount, marked: markedN / n, bigRoad: c.bigRoadPct, unpaved: c.unpavedPct, waterPoints, timeError: err, global: 0, osm: !!idx,
  };
  scores.global = globalScore(scores, c.distanceM / 1000, sport);
  return { ...c, samples, scores, pois };
}

/** Score global (≈ 0 → 1) : nature, curiosités, balisage, eau, temps juste ; les grandes routes pénalisent. */
export function globalScore(s: RouteScores, km: number, sport: RouteSport) {
  const poiDensity = Math.min(1, s.poiCount / Math.max(2, km / 3)); // 1 curiosité tous les 3 km = plein score
  const timeFit = Math.max(0, 1 - Math.abs(s.timeError) / TIME_TOLERANCE);
  const roadPenalty = sport === "RUN" ? 0.4 : 0.2; // à vélo sur route, les routes sont normales
  return 0.45 * s.nature + 0.2 * poiDensity + 0.15 * s.marked + 0.05 * Math.min(1, s.waterPoints) + 0.15 * timeFit - roadPenalty * s.bigRoad;
}

/** Part des échantillons à moins de `r` mètres d'un segment de l'index (voies éclairées…). */
export function shareNear(samples: Sample[], idx: SegIndex, r: number) {
  return samples.filter((s) => idx.near(s.lat, s.lng, r).size).length / (samples.length || 1);
}

// ───────── Recouvrement et choix des 3 boucles ─────────
/** Recouvrement (0 → 1) : part de la boucle la plus « recouverte » qui passe à moins de 30 m de l'autre. */
export function overlap(a: { coords: [number, number, number][]; samples: Sample[] }, b: { coords: [number, number, number][]; samples: Sample[] }) {
  const p = projection(a.coords[0][0]);
  const share = (x: typeof a, y: typeof a) => {
    const idx = new SegIndex(p).add(y.coords.map(([lat, lng]) => [lat, lng] as Pt), 0);
    return x.samples.filter((s) => idx.near(s.lat, s.lng, OVERLAP_NEAR_M).size).length / (x.samples.length || 1);
  };
  return Math.max(share(a, b), share(b, a));
}

export type Choice<T> = { label: string; route: Scored<T> };

/**
 * `lead` d'abord s'il est donné (séance : « Pour le fractionné »…),
 * puis « La nature » (max nature), « Les curiosités » (max POI), « L'équilibrée » (meilleur score global),
 * en écartant toute boucle qui recouvre à 60 % ou plus une boucle déjà choisie.
 * Sans OpenStreetMap : la plus tranquille (moins de grandes routes), la plus juste en temps, l'équilibrée.
 */
export function pickThree<T extends ScoreInput>(
  list: Scored<T>[], pinned: Choice<T>[] = [], max = 3,
  /** Choix pris en premier (après les boucles épinglées) : « Pour le fractionné »… */
  lead?: { label: string; key: (r: Scored<T>) => number },
): Choice<T>[] {
  const chosen: Choice<T>[] = [...pinned], cache = new Map<Scored<T>, Map<Scored<T>, number>>();
  const ov = (a: Scored<T>, b: Scored<T>) => {
    let m = cache.get(a);
    if (!m) cache.set(a, (m = new Map()));
    if (!m.has(b)) m.set(b, overlap(a, b));
    return m.get(b)!;
  };
  const take = (label: string, key: (r: Scored<T>) => number) => {
    // Un libellé déjà pris (complément d'une première sélection) n'est pas redonné.
    if (chosen.length >= max || chosen.some((c) => c.label === label)) return undefined;
    const r = [...list]
      .sort((a, b) => key(b) - key(a) || b.scores.global - a.scores.global)
      .find((x) => chosen.every((c) => c.route !== x && ov(x, c.route) < MAX_OVERLAP));
    if (r) chosen.push({ label, route: r });
    return r;
  };
  if (lead) take(lead.label, lead.key);
  const osm = list.some((r) => r.scores.osm);
  if (osm) {
    take("La nature", (r) => r.scores.nature + (r.scores.weather ?? 0));
    const cur = take("Les curiosités", (r) => r.scores.poiCount);
    if (cur && cur.scores.poiCount === 0) chosen.at(-1)!.label = "L'alternative";
  } else {
    take("La plus tranquille", (r) => -r.scores.bigRoad);
    take("La plus juste", (r) => -Math.abs(r.scores.timeError));
  }
  take("L'équilibrée", (r) => r.scores.global);
  return chosen;
}

// ───────── Phrase « pourquoi » ─────────
const pct = (x: number) => `${Math.round(x * 100)} %`;
const NATURE_WORDS: Record<NatureKind, string> = { forest: "en forêt", water: "au bord de l'eau", heath: "dans les landes", park: "dans les parcs" };

/**
 * « 72 % en forêt ou au bord de l'eau · 3 points de vue · 1 point d'eau ».
 * `water: false` : points d'eau déjà détaillés par l'atout séance (sortie longue).
 */
export function whyText(s: RouteScores, pois: RoutePoi[], opts: { water?: boolean } = {}) {
  if (!s.osm) {
    const parts = [s.bigRoad < 0.05 ? "Quasiment pas de grandes routes" : `${pct(s.bigRoad)} sur grandes routes`];
    if (s.unpaved >= 0.2) parts.push(`${pct(s.unpaved)} non revêtu`);
    parts.push("détails nature indisponibles (OpenStreetMap n'a pas répondu)");
    return parts.join(" · ");
  }
  const parts: string[] = [];
  if (s.nature >= 0.05) {
    const kinds = (Object.keys(s.kinds) as NatureKind[]).filter((k) => s.kinds[k] >= Math.max(0.05, s.nature * 0.25)).sort((a, b) => s.kinds[b] - s.kinds[a]).slice(0, 2);
    parts.push(`${pct(s.nature)} ${kinds.length ? kinds.map((k) => NATURE_WORDS[k]).join(" ou ") : "en nature"}`);
  }
  const counts = new Map<PoiType, number>();
  for (const p of pois) if (!isWaterPoi(p.type)) counts.set(p.type, (counts.get(p.type) ?? 0) + 1);
  [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([t, n]) => parts.push(`${n} ${poiLabel(t, n)}`));
  if (s.waterPoints && opts.water !== false) parts.push(`${s.waterPoints} ${poiLabel("drinking_water", s.waterPoints)}`);
  if (parts.length < 3 && s.marked >= 0.3) parts.push(`${pct(s.marked)} balisé`);
  if (parts.length < 3 && s.bigRoad >= 0.15) parts.push(`${pct(s.bigRoad)} sur grandes routes`);
  if (!parts.length) parts.push(s.bigRoad < 0.05 ? "Petites routes et chemins, peu de nature cartographiée" : "Peu de nature cartographiée sur ce secteur");
  return parts.slice(0, 4).join(" · ");
}
