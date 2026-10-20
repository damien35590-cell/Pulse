/**
 * Générateur de boucles avec OpenRouteService (côté serveur uniquement : ORS_API_KEY ne quitte jamais le serveur).
 * La longueur demandée à ORS n'est qu'indicative : on lance plusieurs seeds, puis on recalibre au prorata.
 */
import { ascentOf, estimateMinutes, kmForMinutes, timeError, withinTolerance, type BikeVariant, type Profile, type RouteSport } from "./estimate";

export type LatLng = { lat: number; lng: number };

/** Réglages du générateur. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
/** ORS rallonge souvent la boucle (×0,9 à ×1,5 mesuré) : on demande un peu moins au premier essai. */
const FIRST_LENGTH_FACTOR = 0.85;
/** D+ supposé au premier essai (m par km), corrigé ensuite par le recalibrage. */
const FIRST_CLIMB_M_PER_KM = 8;
const MAX_CALLS = 20;
const RECALIBRATIONS = 2;
const RECALIBRATE_PER_ROUND = 6;
const PARALLEL = 4;
const CALL_TIMEOUT_MS = 10_000;
/** Limite du plan gratuit ORS sur /directions. */
const RATE_PER_MIN = 40;

export const orsProfile = (sport: RouteSport, variant?: BikeVariant) =>
  sport === "RUN" ? "foot-hiking" : variant === "trail" ? "cycling-mountain" : "cycling-road";

export type Candidate = {
  key: string; // seed-points
  seed: number;
  points: number;
  length: number; // longueur demandée (m)
  coords: [number, number, number][]; // [lat, lng, ele]
  distanceM: number;
  ascentM: number;
  estMinutes: number;
  /** Part de la distance par type de voie ORS (waytype) : 1 = State Road, 2 = Road… */
  bigRoadPct: number;
  unpavedPct: number;
};

export class RoutingError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}

// Appels des 60 dernières secondes, partagés par les requêtes d'une même instance.
const calls: number[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForSlot(deadline: number) {
  for (;;) {
    const now = Date.now();
    while (calls.length && now - calls[0] > 60_000) calls.shift();
    if (calls.length < RATE_PER_MIN) { calls.push(now); return true; }
    const wait = 60_000 - (now - calls[0]) + 50;
    if (now + wait > deadline) return false;
    await sleep(wait);
  }
}

type OrsFeature = {
  geometry: { coordinates: [number, number, number][] };
  properties: { summary: { distance: number }; ascent?: number; extras?: Record<string, { values: [number, number, number][] }> };
};

/** Part de la distance (0 → 1) dont la valeur d'extra ORS est dans `codes`. */
export function extraShare(coords: [number, number, number][], values: [number, number, number][] | undefined, codes: number[]) {
  if (!values?.length) return 0;
  const seg = (i: number) => {
    const a = coords[i], b = coords[i + 1], k = Math.cos((a[0] * Math.PI) / 180);
    return Math.hypot((b[0] - a[0]) * 110_540, (b[1] - a[1]) * 111_320 * k);
  };
  let all = 0, hit = 0;
  for (const [from, to, v] of values) {
    let d = 0;
    for (let i = from; i < to && i < coords.length - 1; i++) d += seg(i);
    all += d;
    if (codes.includes(v)) hit += d;
  }
  return all ? hit / all : 0;
}

// Codes ORS : waytype 1 = State Road, 2 = Road ; surface non revêtue = 2, 8 à 12, 15 à 17.
const BIG_ROADS = [1, 2];
const UNPAVED = [2, 8, 9, 10, 11, 12, 15, 16, 17];

type Ctx = { start: LatLng; profile: Profile; ors: string; key: string; deadline: number; used: number; rateLimited: boolean };

async function callOrs(ctx: Ctx, seed: number, points: number, length: number): Promise<Candidate | null> {
  if (ctx.used >= MAX_CALLS || ctx.rateLimited || Date.now() > ctx.deadline) return null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (ctx.used >= MAX_CALLS || !(await waitForSlot(ctx.deadline))) return null;
    ctx.used++;
    let res: Response;
    try {
      res = await fetch(`https://api.openrouteservice.org/v2/directions/${ctx.ors}/geojson`, {
        method: "POST",
        headers: { Authorization: ctx.key, "Content-Type": "application/json", Accept: "application/geo+json" },
        body: JSON.stringify({
          coordinates: [[ctx.start.lng, ctx.start.lat]],
          options: { round_trip: { length: Math.round(length), points, seed } },
          elevation: true,
          extra_info: ["waytype", "surface", "steepness"],
          instructions: false,
        }),
        signal: AbortSignal.timeout(Math.min(CALL_TIMEOUT_MS, Math.max(1000, ctx.deadline - Date.now()))),
        cache: "no-store",
      });
    } catch {
      return null; // délai dépassé ou réseau : on passe à la suivante
    }
    if (res.status === 429) {
      // Quota minute ou jour atteint : une seule nouvelle tentative après la pause demandée.
      const wait = Math.min(8000, Number(res.headers.get("retry-after")) * 1000 || 3000);
      if (attempt === 0 && Date.now() + wait < ctx.deadline) { await sleep(wait); continue; }
      ctx.rateLimited = true;
      return null;
    }
    if (res.status === 401 || res.status === 403) throw new RoutingError("Clé OpenRouteService refusée : vérifie ORS_API_KEY.", 500);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const code = body?.error?.code as number | undefined;
      // 2010 : point non routable ; 2009 : aucune route trouvée.
      if (code === 2010) throw new RoutingError("Le point de départ est trop loin d'une route ou d'un chemin praticable.", 422);
      return null;
    }
    const f = body?.features?.[0] as OrsFeature | undefined;
    if (!f || f.geometry.coordinates.length < 2) return null;
    const coords = f.geometry.coordinates.map(([lng, lat, ele]) => [lat, lng, ele ?? 0] as [number, number, number]);
    const distanceM = f.properties.summary.distance;
    const ascentM = ascentOf(coords.map((c) => c[2]));
    return {
      key: `${seed}-${points}`, seed, points, length, coords, distanceM, ascentM,
      estMinutes: estimateMinutes(ctx.profile, distanceM / 1000, ascentM),
      bigRoadPct: extraShare(coords, f.properties.extras?.waytype?.values, BIG_ROADS),
      unpavedPct: extraShare(coords, f.properties.extras?.surface?.values, UNPAVED),
    };
  }
  return null;
}

/** Exécute les tâches par paquets de `PARALLEL`. */
async function pool<T, R>(items: T[], fn: (t: T) => Promise<R>) {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += PARALLEL) out.push(...(await Promise.all(items.slice(i, i + PARALLEL).map(fn))));
  return out;
}

/**
 * Boucles candidates à ±10 % du temps visé (au plus 20 appels ORS).
 * Renvoie aussi les meilleures hors tolérance, pour expliquer un échec.
 */
export async function generateCandidates(opts: { start: LatLng; profile: Profile; minutes: number; deadline: number }) {
  const key = process.env.ORS_API_KEY;
  if (!key) throw new RoutingError("ORS_API_KEY n'est pas configurée sur le serveur.", 500);
  const { start, profile, minutes } = opts;
  const ctx: Ctx = { start, profile, ors: orsProfile(profile.sport, profile.variant), key, deadline: opts.deadline, used: 0, rateLimited: false };

  const length0 = kmForMinutes(profile, minutes, FIRST_CLIMB_M_PER_KM) * 1000 * FIRST_LENGTH_FACTOR;
  const best = new Map<string, Candidate>();
  const last = new Map<string, Candidate>(); // dernier essai par seed : point de départ du recalibrage suivant
  const keep = (c: Candidate | null) => {
    if (!c) return;
    last.set(c.key, c);
    const prev = best.get(c.key);
    if (!prev || Math.abs(timeError(c.estMinutes, minutes)) < Math.abs(timeError(prev.estMinutes, minutes))) best.set(c.key, c);
  };

  (await pool(SEEDS, (seed) => callOrs(ctx, seed, seed % 2 ? 3 : 5, length0))).forEach(keep);

  for (let round = 0; round < RECALIBRATIONS; round++) {
    const all = [...best.values()];
    if (all.filter((c) => withinTolerance(c.estMinutes, minutes)).length >= RECALIBRATE_PER_ROUND) break;
    const off = all
      .filter((c) => !withinTolerance(c.estMinutes, minutes))
      .sort((a, b) => Math.abs(timeError(a.estMinutes, minutes)) - Math.abs(timeError(b.estMinutes, minutes)))
      .slice(0, Math.min(RECALIBRATE_PER_ROUND, MAX_CALLS - ctx.used))
      .map((c) => last.get(c.key)!);
    if (!off.length) break;
    // Prorata : même seed, longueur demandée × (temps visé / temps obtenu), bornée pour éviter les extrêmes.
    (await pool(off, (c) => callOrs(ctx, c.seed, c.points, c.length * Math.min(2, Math.max(0.5, minutes / c.estMinutes))))).forEach(keep);
  }

  const all = [...best.values()];
  return { candidates: all.filter((c) => withinTolerance(c.estMinutes, minutes)), all, calls: ctx.used, rateLimited: ctx.rateLimited };
}
