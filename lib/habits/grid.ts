/**
 * Habitudes de parcours, à partir de tes traces GPS. Fonctions pures (tests : tools/test-habits.ts).
 * - Carte de chaleur : une grille de 40 m, chaque case compte le nombre de sorties qui y passent.
 * - Classiques : sorties qui partent du même endroit et suivent le même tracé (au moins 3).
 * - Bifurcations : endroits où tes sorties, arrivées par le même chemin, se séparent ; avec la part de chaque branche.
 * Toutes les distances sont calculées dans une projection locale (précise à l'échelle d'un secteur).
 */

export type LL = [number, number]; // [lat, lng]

/** Une sortie avec sa trace (polyline décodée). */
export type Trace = { id: string; startedAt: string; pts: LL[]; distanceM: number; movingTimeS: number; ascentM: number };

export type Classic = {
  id: string;
  /** Nom du lieu le plus éloigné du départ (rempli côté serveur), ex. « Étang de Paimpont ». */
  name: string | null;
  /** Trace de la sortie la plus représentative (polyline encodée côté serveur). */
  repId: string;
  pts: LL[];
  start: { lat: number; lng: number };
  far: { lat: number; lng: number };
  loop: boolean;
  count: number;
  distanceM: number;
  ascentM: number;
  medianMovingS: number;
  bestMovingS: number;
  lastAt: string;
  activityIds: string[];
};

export type Turn = "left" | "straight" | "right";
export type Branch = { lat: number; lng: number; bearing: number; count: number; turn: Turn };
export type Junction = { id: string; lat: number; lng: number; approach: number; total: number; branches: Branch[]; name: string | null };

/** Réglages. */
export const CELL_M = 40;
const HEAT_STEP_M = 10;
const DENSE_STEP_M = 20;
const SIG_POINTS = 64;
const NEAR_CAP_M = 150;
/** Classiques : départs à moins de 500 m, longueurs à ±15 %, écart moyen entre les tracés < 50 m (course) / 90 m (vélo). */
const START_NEAR_M = 500;
const LENGTH_RATIO = 1.18;
export const SAME_ROUTE_M = { RUN: 50, RIDE: 90 } as const;
export const CLASSIC_MIN = 3;
const MAX_CLASSICS = 12;
const LOOP_END_M = 400;
/** Bifurcations : au moins 4 sorties arrivées par le même chemin, branches regardées 160 m plus loin. */
export const JUNCTION_MIN = 4;
const AHEAD_STEPS = 8; // × 20 m
const BEHIND_STEPS = 5;
const BRANCH_RADIUS_M = 50;
const SPLIT_M = 30;
const HEADING_GROUP_DEG = 40;
const MAX_JUNCTIONS = 20;
const JUNCTION_MERGE_M = 60;

// ───────── Projection locale ─────────
export type Proj = { kx: number; ky: number; lat0: number };
export const proj = (lat0: number): Proj => ({ kx: 111_320 * Math.cos((lat0 * Math.PI) / 180), ky: 110_540, lat0 });
const X = (p: Proj, ll: LL) => ll[1] * p.kx;
const Y = (p: Proj, ll: LL) => ll[0] * p.ky;
export const dist = (p: Proj, a: LL, b: LL) => Math.hypot(X(p, a) - X(p, b), Y(p, a) - Y(p, b));
/** Cap de a vers b, en degrés (0 = nord, 90 = est). */
export const bearing = (p: Proj, a: LL, b: LL) => ((Math.atan2(X(p, b) - X(p, a), Y(p, b) - Y(p, a)) * 180) / Math.PI + 360) % 360;
/** Différence d'angle signée (-180 → 180] : positive = vers la droite. */
export const angleDiff = (a: number, b: number) => { const d = (((b - a) % 360) + 540) % 360 - 180; return d === -180 ? 180 : d; };
const circMean = (degs: number[]) => {
  const s = degs.reduce((acc, d) => acc + Math.sin((d * Math.PI) / 180), 0), c = degs.reduce((acc, d) => acc + Math.cos((d * Math.PI) / 180), 0);
  return ((Math.atan2(s, c) * 180) / Math.PI + 360) % 360;
};

/** Un point tous les `step` mètres le long du tracé. */
export function resample(p: Proj, pts: LL[], step: number): LL[] {
  if (pts.length < 2) return pts.slice();
  const out: LL[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], d = dist(p, a, b);
    if (d === 0) continue;
    let pos = step - carry;
    while (pos <= d) {
      const t = pos / d;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      pos += step;
    }
    carry = d - (pos - step);
  }
  const last = pts[pts.length - 1];
  if (dist(p, out[out.length - 1], last) > step / 3) out.push(last);
  return out;
}

export const lengthOf = (p: Proj, pts: LL[]) => pts.reduce((s, q, i) => (i ? s + dist(p, pts[i - 1], q) : 0), 0);

// ───────── Carte de chaleur ─────────
export const cellOf = (p: Proj, ll: LL, cellM = CELL_M) => [Math.floor(Y(p, ll) / cellM), Math.floor(X(p, ll) / cellM)] as const;
const key = (r: number, c: number) => `${r}:${c}`;

/** Cases traversées par au moins une sortie : [ligne, colonne, nombre de sorties]. */
export function buildHeat(p: Proj, traces: Trace[], cellM = CELL_M): [number, number, number][] {
  const n = new Map<string, number>();
  for (const t of traces) {
    const seen = new Set<string>();
    for (const ll of resample(p, t.pts, HEAT_STEP_M)) {
      const [r, c] = cellOf(p, ll, cellM), k = key(r, c);
      if (!seen.has(k)) { seen.add(k); n.set(k, (n.get(k) ?? 0) + 1); }
    }
  }
  return [...n].map(([k, v]) => { const [r, c] = k.split(":").map(Number); return [r, c, v] as [number, number, number]; });
}

/** Recherche rapide « combien de passages ici ? » (case et ses 8 voisines : tolère le décalage du GPS). */
export class Heat {
  private m = new Map<string, number>();
  readonly p: Proj;
  constructor(lat0: number, cells: [number, number, number][], readonly cellM = CELL_M) {
    this.p = proj(lat0);
    for (const [r, c, v] of cells) this.m.set(key(r, c), v);
  }
  at(ll: LL) {
    const [r, c] = cellOf(this.p, ll, this.cellM);
    let best = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) best = Math.max(best, this.m.get(key(r + i, c + j)) ?? 0);
    return best;
  }
  get size() { return this.m.size; }
}

/** Part (0 → 1) des points d'un tracé sur tes chemins habituels (au moins `min` sorties). */
export function familiarity(heat: Heat, pts: LL[], min = 2) {
  if (!pts.length) return 0;
  return pts.filter((ll) => heat.at(ll) >= min).length / pts.length;
}

// ───────── Classiques ─────────
type Sig = { t: Trace; dense: LL[]; sig: LL[]; len: number; grid: Map<string, LL[]> };
const GRID_M = 50;

function signature(p: Proj, t: Trace): Sig | null {
  const dense = resample(p, t.pts, DENSE_STEP_M);
  if (dense.length < 10) return null;
  const len = lengthOf(p, dense);
  const sig = Array.from({ length: SIG_POINTS }, (_, i) => dense[Math.round((i * (dense.length - 1)) / (SIG_POINTS - 1))]);
  const grid = new Map<string, LL[]>();
  for (const ll of dense) { const [r, c] = cellOf(p, ll, GRID_M), k = key(r, c); (grid.get(k) ?? grid.set(k, []).get(k)!).push(ll); }
  return { t, dense, sig, len, grid };
}

function nearest(p: Proj, ll: LL, b: Sig) {
  const [r, c] = cellOf(p, ll, GRID_M);
  let best = NEAR_CAP_M;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of b.grid.get(key(r + i, c + j)) ?? []) best = Math.min(best, dist(p, ll, q));
  return best;
}

/** Écart moyen (m) entre deux tracés, dans les deux sens (le sens de parcours ne compte pas). */
function gap(p: Proj, a: Sig, b: Sig) {
  const one = (x: Sig, y: Sig) => x.sig.reduce((s, ll) => s + nearest(p, ll, y), 0) / x.sig.length;
  return Math.max(one(a, b), one(b, a));
}

function sameRoute(p: Proj, a: Sig, b: Sig, maxGap: number) {
  const r = a.len / b.len;
  if (r > LENGTH_RATIO || r < 1 / LENGTH_RATIO) return false;
  const startsNear = dist(p, a.dense[0], b.dense[0]) <= START_NEAR_M || dist(p, a.dense[0], b.dense[b.dense.length - 1]) <= START_NEAR_M;
  return startsNear && gap(p, a, b) <= maxGap;
}

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Regroupe les sorties qui suivent le même tracé ; un groupe d'au moins 3 sorties est un classique. */
export function findClassics(p: Proj, traces: Trace[], sport: keyof typeof SAME_ROUTE_M): Classic[] {
  const sigs = [...traces].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).map((t) => signature(p, t)).filter((s): s is Sig => !!s);
  const groups: Sig[][] = [];
  for (const s of sigs) {
    const g = groups.find((g) => sameRoute(p, g[0], s, SAME_ROUTE_M[sport]));
    if (g) g.push(s); else groups.push([s]);
  }
  return groups
    .filter((g) => g.length >= CLASSIC_MIN)
    .sort((a, b) => b.length - a.length)
    .slice(0, MAX_CLASSICS)
    .map((g) => {
      // Sortie représentative : la plus proche des autres (sur 12 au plus).
      const pool = g.slice(0, 12);
      const rep = pool.length < 3 ? pool[0] : pool.map((x) => ({ x, s: pool.reduce((s, y) => (y === x ? s : s + gap(p, x, y)), 0) })).sort((a, b) => a.s - b.s)[0].x;
      const start = rep.dense[0], end = rep.dense[rep.dense.length - 1];
      const far = rep.dense.reduce((f, ll) => (dist(p, start, ll) > dist(p, start, f) ? ll : f), start);
      const ts = g.map((x) => x.t);
      return {
        id: `c-${rep.t.id}`, name: null, repId: rep.t.id, pts: rep.t.pts,
        start: { lat: start[0], lng: start[1] }, far: { lat: far[0], lng: far[1] }, loop: dist(p, start, end) <= LOOP_END_M,
        count: g.length,
        distanceM: Math.round(median(ts.map((t) => t.distanceM))),
        ascentM: Math.round(median(ts.map((t) => t.ascentM))),
        medianMovingS: Math.round(median(ts.map((t) => t.movingTimeS))),
        bestMovingS: Math.min(...ts.map((t) => t.movingTimeS)),
        lastAt: ts[0].startedAt,
        activityIds: ts.map((t) => t.id),
      };
    });
}

// ───────── Bifurcations ─────────
type Pass = { ti: number; i: number; h: number };

function turnOf(rel: number): Turn | null {
  if (Math.abs(rel) > 150) return null; // demi-tour (aller-retour) : pas une bifurcation
  return Math.abs(rel) <= 30 ? "straight" : rel < 0 ? "left" : "right";
}

/** Regroupe des points proches (glouton, rayon r) : renvoie l'indice de groupe de chaque point. */
function cluster(p: Proj, pts: LL[], r: number) {
  const centers: LL[] = [], sizes: number[] = [];
  const of = pts.map((ll) => {
    const g = centers.findIndex((c) => dist(p, c, ll) <= r);
    if (g >= 0) { sizes[g]++; centers[g] = [centers[g][0] + (ll[0] - centers[g][0]) / sizes[g], centers[g][1] + (ll[1] - centers[g][1]) / sizes[g]]; return g; }
    centers.push(ll); sizes.push(1); return centers.length - 1;
  });
  return { of, sizes };
}
const meanLL = (pts: LL[]): LL => [pts.reduce((s, q) => s + q[0], 0) / pts.length, pts.reduce((s, q) => s + q[1], 0) / pts.length];

/**
 * Endroits où tes sorties arrivées par le même chemin se séparent, avec la part de chaque branche.
 * Arrivées par des chemins différents (carrefour où l'on ne fait que se rejoindre) : ignoré.
 */
export function findJunctions(p: Proj, traces: Trace[]): Junction[] {
  const dense = traces.map((t) => resample(p, t.pts, DENSE_STEP_M));
  const heading = (pts: LL[], i: number) => bearing(p, pts[Math.max(0, i - 1)], pts[Math.min(pts.length - 1, i + 1)]);

  // Passages par case, une fois par sortie et par sens (un nouveau passage si la sortie revient plus tard).
  const passes = new Map<string, Pass[]>();
  dense.forEach((pts, ti) => {
    const last = new Map<string, number>();
    for (let i = BEHIND_STEPS; i < pts.length - AHEAD_STEPS; i++) {
      const [r, c] = cellOf(p, pts[i]), h = heading(pts, i), k = `${key(r, c)}:${Math.floor(h / 45)}`;
      const prev = last.get(k);
      last.set(k, i);
      if (prev != null && i - prev <= 5) continue;
      const list = passes.get(key(r, c));
      if (list) list.push({ ti, i, h }); else passes.set(key(r, c), [{ ti, i, h }]);
    }
  });

  const found: Junction[] = [];
  for (const [cell, list] of passes) {
    if (new Set(list.map((x) => x.ti)).size < JUNCTION_MIN) continue;
    // Groupes de passages dans le même sens.
    const groups: Pass[][] = [];
    for (const x of list) {
      const g = groups.find((g) => Math.abs(angleDiff(circMean(g.map((y) => y.h)), x.h)) <= HEADING_GROUP_DEG);
      if (g) { if (!g.some((y) => y.ti === x.ti)) g.push(x); } else groups.push([x]);
    }
    for (const g of groups) {
      if (g.length < JUNCTION_MIN) continue;
      // Tous arrivés par le même chemin ?
      const behind = g.map((x) => dense[x.ti][x.i - BEHIND_STEPS]);
      const b = cluster(p, behind, BRANCH_RADIUS_M);
      if (Math.max(...b.sizes) / g.length < 0.6) continue;
      // Où vont-ils 160 m plus loin ?
      const ahead = g.map((x) => dense[x.ti][x.i + AHEAD_STEPS]);
      const a = cluster(p, ahead, BRANCH_RADIUS_M);
      const branchIds = a.sizes.map((n, k) => ({ n, k })).filter(({ n }) => n >= 2 && n / g.length >= 0.15).sort((x, y) => y.n - x.n);
      if (branchIds.length < 2) continue;
      // Point de séparation : le dernier pas où les deux branches principales sont encore côte à côte.
      const [b1, b2] = branchIds;
      let split = 0;
      for (let k = 1; k <= AHEAD_STEPS; k++) {
        const c1 = meanLL(g.filter((_, j) => a.of[j] === b1.k).map((x) => dense[x.ti][x.i + k]));
        const c2 = meanLL(g.filter((_, j) => a.of[j] === b2.k).map((x) => dense[x.ti][x.i + k]));
        if (dist(p, c1, c2) > SPLIT_M) break;
        split = k;
      }
      if (split === AHEAD_STEPS) continue;
      const at = meanLL(g.map((x) => dense[x.ti][x.i + split]));
      const approach = circMean(g.map((x) => x.h));
      const branches: Branch[] = [];
      for (const { n, k } of branchIds) {
        const c = meanLL(g.filter((_, j) => a.of[j] === k).map((x) => dense[x.ti][x.i + AHEAD_STEPS]));
        const br = bearing(p, at, c), turn = turnOf(angleDiff(approach, br));
        if (turn) branches.push({ lat: c[0], lng: c[1], bearing: Math.round(br), count: n, turn });
      }
      if (branches.length < 2 || new Set(branches.map((x) => x.turn)).size < 2) continue;
      const total = branches.reduce((s, x) => s + x.count, 0);
      found.push({ id: `j-${cell}-${Math.round(approach)}`, lat: at[0], lng: at[1], approach: Math.round(approach), total, branches, name: null });
    }
  }

  // Un même carrefour est vu depuis plusieurs cases en amont : on garde le plus fréquenté.
  const kept: Junction[] = [];
  for (const j of found.sort((x, y) => y.total - x.total || y.branches.length - x.branches.length)) {
    if (kept.some((k) => dist(p, [k.lat, k.lng], [j.lat, j.lng]) <= JUNCTION_MERGE_M && Math.abs(angleDiff(k.approach, j.approach)) <= 45)) continue;
    kept.push(j);
    if (kept.length >= MAX_JUNCTIONS) break;
  }
  return kept;
}

// ───────── Textes ─────────
const TURN_WORDS: Record<Turn, string> = { left: "à gauche", straight: "tout droit", right: "à droite" };
export const turnWord = (t: Turn) => TURN_WORDS[t];

/** « Tu prends à gauche 7 fois sur 10 » (branche principale). */
export function junctionText(j: Pick<Junction, "branches" | "total">) {
  const main = [...j.branches].sort((a, b) => b.count - a.count)[0];
  return `Tu prends ${turnWord(main.turn)} ${main.count} fois sur ${j.total}`;
}

/** Nom d'un classique : « Boucle vers l'Étang de Paimpont », « Aller-retour vers … », sinon « Boucle de 6,2 km ». */
export function classicTitle(c: { name: string | null; loop: boolean; distanceM?: number }) {
  const kind = c.loop ? "Boucle" : "Aller-retour";
  if (c.name) return `${kind} vers ${c.name}`;
  return c.distanceM ? `${kind} de ${(c.distanceM / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km` : `Ta ${c.loop ? "boucle" : "sortie"} habituelle`;
}

