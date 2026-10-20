/**
 * Données OpenStreetMap pour noter les boucles : nature, points d'intérêt, itinéraires balisés.
 * Une seule requête Overpass sur les tuiles manquantes, puis découpage et cache en base par tuile (30 jours).
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyPoi, type PoiType } from "./poi";

export type Pt = [number, number]; // [lat, lng]
export type BBox = { s: number; w: number; n: number; e: number };
/** forest = forêt, bois ; water = eau, rivière, zone humide ; heath = landes, broussailles ; park = parc, réserve. */
export type NatureKind = "forest" | "water" | "heath" | "park";
/** area : polygone complet (test « dedans ») ; sinon seuls les bords comptent (rivière, relation coupée). */
export type NatureFeature = { id: string; k: NatureKind; lines: Pt[][]; area: boolean };
export type OsmPoi = { id: string; t: PoiType; n?: string; lat: number; lng: number };
export type RouteKind = "foot" | "bike";
export type MarkedRoute = { id: string; k: RouteKind; n?: string; lines: Pt[][] };
export type OsmData = { nature: NatureFeature[]; pois: OsmPoi[]; routes: MarkedRoute[] };

const URL = "https://overpass-api.de/api/interpreter";
/** Taille d'une tuile de cache (degrés) : environ 5,5 × 3,7 km en Bretagne. */
export const TILE = 0.05;
const CACHE_DAYS = 30;
const VERSION = "ovp1";
/** Les relations sont découpées par Overpass à la zone demandée + cette marge (degrés). */
const REL_MARGIN = 0.01;
// Overpass public met parfois 40 s à répondre (file d'attente) : on lui laisse tout le temps restant.
const FETCH_TIMEOUT_MS = 48_000;

const r5 = (x: number) => Math.round(x * 1e5) / 1e5;
const tileOf = (lat: number, lng: number) => [Math.floor(lat / TILE), Math.floor(lng / TILE)] as const;
const tileKey = (ty: number, tx: number) => `${VERSION}:${ty}:${tx}`;

export function tilesFor(b: BBox) {
  const [y0, x0] = tileOf(b.s, b.w), [y1, x1] = tileOf(b.n, b.e), out: { key: string; ty: number; tx: number }[] = [];
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) out.push({ key: tileKey(ty, tx), ty, tx });
  return out;
}

function natureKind(tags: Record<string, string>): NatureKind | null {
  if (tags.landuse === "forest" || tags.natural === "wood") return "forest";
  if (tags.natural === "water" || tags.natural === "wetland" || tags.waterway) return "water";
  if (tags.natural === "heath" || tags.natural === "scrub") return "heath";
  if (tags.leisure === "park" || tags.leisure === "nature_reserve") return "park";
  return null;
}

function routeKind(route?: string): RouteKind | null {
  if (route === "hiking" || route === "foot" || route === "running") return "foot";
  if (route === "bicycle" || route === "mtb") return "bike";
  return null;
}

type Geo = ({ lat: number; lon: number } | null)[] | undefined;
type El = {
  type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number };
  tags?: Record<string, string>; geometry?: Geo; members?: { type: string; role: string; geometry?: Geo }[];
};

/** Géométrie découpée par Overpass (null hors zone) → tronçons continus. */
function lines(g: Geo): { parts: Pt[][]; complete: boolean } {
  const parts: Pt[][] = [];
  let cur: Pt[] = [], complete = !!g?.length;
  for (const p of g ?? []) {
    if (!p || p.lat == null) { complete = false; if (cur.length > 1) parts.push(cur); cur = []; continue; }
    cur.push([r5(p.lat), r5(p.lon)]);
  }
  if (cur.length > 1) parts.push(cur);
  return { parts, complete };
}

export function parseOverpass(elements: El[]): OsmData {
  const out: OsmData = { nature: [], pois: [], routes: [] };
  for (const el of elements) {
    const tags = el.tags ?? {}, id = `${el.type[0]}${el.id}`;
    const rk = el.type === "relation" ? routeKind(tags.route) : null;
    if (rk) {
      const parts = (el.members ?? []).filter((m) => m.type === "way").flatMap((m) => lines(m.geometry).parts);
      if (parts.length) out.routes.push({ id, k: rk, n: tags.name, lines: parts });
      continue;
    }
    const poi = classifyPoi(tags);
    const at = el.type === "node" ? (el.lat != null ? { lat: el.lat, lon: el.lon! } : null) : el.center;
    if (poi && at) { out.pois.push({ id, t: poi, n: tags.name, lat: r5(at.lat), lng: r5(at.lon) }); continue; }
    const k = natureKind(tags);
    if (!k) continue;
    if (el.type === "way") {
      const { parts, complete } = lines(el.geometry);
      const ring = parts[0];
      const closed = complete && parts.length === 1 && ring.length >= 4 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1];
      if (parts.length) out.nature.push({ id, k, lines: parts, area: closed && !tags.waterway });
    } else if (el.type === "relation") {
      // Multipolygone : la règle pair-impair sur tous les segments des membres suffit, à condition qu'aucun ne soit coupé.
      const ways = (el.members ?? []).filter((m) => m.type === "way").map((m) => lines(m.geometry));
      const parts = ways.flatMap((w) => w.parts);
      if (parts.length) out.nature.push({ id, k, lines: parts, area: ways.every((w) => w.complete) });
    }
  }
  return out;
}

const bboxOfLines = (ls: Pt[][]): BBox => {
  let s = 90, w = 180, n = -90, e = -180;
  for (const l of ls) for (const [a, b] of l) { if (a < s) s = a; if (a > n) n = a; if (b < w) w = b; if (b > e) e = b; }
  return { s, w, n, e };
};
const intersects = (a: BBox, b: BBox) => a.s <= b.n && a.n >= b.s && a.w <= b.e && a.e >= b.w;
const tileBox = (ty: number, tx: number): BBox => ({ s: ty * TILE, w: tx * TILE, n: (ty + 1) * TILE, e: (tx + 1) * TILE });

function buildQuery(b: BBox) {
  const box = `${b.s},${b.w},${b.n},${b.e}`;
  const rel = `${b.s - REL_MARGIN},${b.w - REL_MARGIN},${b.n + REL_MARGIN},${b.e + REL_MARGIN}`;
  return `[out:json][timeout:25][bbox:${box}];
(way[landuse=forest];way[natural~"^(wood|water|wetland|heath|scrub)$"];way[leisure~"^(park|nature_reserve)$"];way[waterway~"^(river|stream|canal)$"];);
out geom qt;
(rel[landuse=forest];rel[natural~"^(wood|water|wetland|heath|scrub)$"];rel[leisure~"^(park|nature_reserve)$"];);
out geom(${rel}) qt;
(nw[tourism~"^(viewpoint|attraction|artwork|picnic_site)$"];nw[natural~"^(peak|spring|waterfall|cave_entrance)$"];nw[historic];nw[man_made~"^(lighthouse|tower|windmill)$"];node[amenity=drinking_water];);
out center qt;
rel[route~"^(hiking|foot|running|bicycle|mtb)$"];
out geom(${rel}) qt;`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOverpass(b: BBox, deadline: number): Promise<El[]> {
  for (let attempt = 0; ; attempt++) {
    const left = deadline - Date.now();
    if (left < 3000) throw new Error("Plus assez de temps pour interroger OpenStreetMap.");
    const res = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Pulse/1.0 (appli perso d'entraînement)" },
      body: "data=" + encodeURIComponent(buildQuery(b)),
      signal: AbortSignal.timeout(Math.min(FETCH_TIMEOUT_MS, left)),
      cache: "no-store",
    });
    // Serveur saturé : une nouvelle tentative s'il reste assez de temps.
    if ((res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504) && attempt === 0 && deadline - Date.now() > 20_000) { await sleep(2000); continue; }
    if (!res.ok) throw new Error(`Overpass a répondu ${res.status}.`);
    const j = await res.json();
    if (j.remark && /runtime error|timed out/i.test(j.remark)) throw new Error("Overpass a dépassé son délai.");
    return j.elements ?? [];
  }
}

/** Fusionne les tuiles : un élément présent dans plusieurs tuiles n'est gardé qu'une fois (la version complète d'abord). */
export function mergeTiles(tiles: OsmData[]): OsmData {
  const pick = <T extends { id: string }>(list: T[], better: (a: T, b: T) => boolean) => {
    const m = new Map<string, T>();
    for (const x of list) { const p = m.get(x.id); if (!p || better(x, p)) m.set(x.id, x); }
    return [...m.values()];
  };
  const size = (ls: Pt[][]) => ls.reduce((s, l) => s + l.length, 0);
  return {
    nature: pick(tiles.flatMap((t) => t.nature), (a, b) => (a.area && !b.area) || (a.area === b.area && size(a.lines) > size(b.lines))),
    pois: pick(tiles.flatMap((t) => t.pois), () => false),
    routes: pick(tiles.flatMap((t) => t.routes), (a, b) => size(a.lines) > size(b.lines)),
  };
}

/**
 * Données OSM sur la zone : depuis le cache si possible, sinon une requête Overpass sur l'ensemble des tuiles manquantes.
 * Renvoie null (avec la raison) si Overpass ne répond pas : la recherche continue sans note nature.
 */
export async function loadOsm(b: BBox, deadline: number): Promise<{ data: OsmData | null; cached: number; fetched: number; error?: string }> {
  const tiles = tilesFor(b);
  const since = new Date(Date.now() - CACHE_DAYS * 864e5);
  const rows = await prisma.overpassCache.findMany({ where: { key: { in: tiles.map((t) => t.key) }, fetchedAt: { gte: since } } });
  const have = new Map(rows.map((r) => [r.key, r.data as unknown as OsmData]));
  const missing = tiles.filter((t) => !have.has(t.key));
  if (!missing.length) return { data: mergeTiles([...have.values()]), cached: rows.length, fetched: 0 };

  const req: BBox = {
    s: Math.min(...missing.map((t) => t.ty)) * TILE, w: Math.min(...missing.map((t) => t.tx)) * TILE,
    n: (Math.max(...missing.map((t) => t.ty)) + 1) * TILE, e: (Math.max(...missing.map((t) => t.tx)) + 1) * TILE,
  };
  let osm: OsmData;
  try {
    osm = parseOverpass(await fetchOverpass(req, deadline));
  } catch (e) {
    return { data: null, cached: rows.length, fetched: 0, error: e instanceof Error ? e.message : "Overpass indisponible." };
  }

  // Découpage par tuile : chaque élément va dans les tuiles que touche son emprise.
  const per = new Map(missing.map((t) => [t.key, { box: tileBox(t.ty, t.tx), data: { nature: [], pois: [], routes: [] } as OsmData }]));
  for (const t of per.values()) {
    t.data.nature = osm.nature.filter((f) => intersects(bboxOfLines(f.lines), t.box));
    t.data.routes = osm.routes.filter((f) => intersects(bboxOfLines(f.lines), t.box));
    t.data.pois = osm.pois.filter((p) => p.lat >= t.box.s && p.lat < t.box.n && p.lng >= t.box.w && p.lng < t.box.e);
  }
  const now = new Date();
  await prisma.$transaction([
    prisma.overpassCache.deleteMany({ where: { OR: [{ key: { in: missing.map((t) => t.key) } }, { fetchedAt: { lt: since } }] } }),
    prisma.overpassCache.createMany({ data: [...per].map(([key, t]) => ({ key, data: t.data as unknown as Prisma.InputJsonValue, fetchedAt: now })) }),
  ]).catch(() => undefined); // le cache est un bonus : une erreur d'écriture ne doit pas faire échouer la recherche

  return { data: mergeTiles([...have.values(), osm]), cached: rows.length, fetched: missing.length };
}
