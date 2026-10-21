/** Calcul et lecture des habitudes de parcours (côté serveur). */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decodePolyline, encodePolyline } from "@/lib/polyline";
import { isCommute } from "@/lib/routes/estimate";
import { placeAt } from "@/lib/routes/places";
import { buildHeat, CELL_M, dist, findClassics, findJunctions, Heat, proj, type Classic, type Junction, type LL, type Trace } from "./grid";

export type HabitSport = "RUN" | "RIDE";
export const HABIT_SPORTS: HabitSport[] = ["RUN", "RIDE"];
/** Classique tel qu'enregistré : la trace est encodée. */
export type StoredClassic = Omit<Classic, "pts"> & { polyline: string };
export type HabitView = {
  sport: HabitSport; lat0: number; cellM: number; cells: [number, number, number][];
  classics: StoredClassic[]; junctions: Junction[]; traces: number; builtAt: string;
};

/** Noms de lieux : au plus 12 recherches Photon par calcul (1 par seconde), les noms déjà trouvés sont repris. */
const NAME_BUDGET = 12;
const NAME_REUSE_M = 150;
const PHOTON_GAP_MS = 1100;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const toView = (m: { sport: string; lat0: number; cellM: number; cells: unknown; classics: unknown; junctions: unknown; traces: number; builtAt: Date }): HabitView => ({
  sport: m.sport === "RIDE" ? "RIDE" : "RUN", lat0: m.lat0, cellM: m.cellM,
  cells: (m.cells as HabitView["cells"]) ?? [], classics: (m.classics as StoredClassic[]) ?? [], junctions: (m.junctions as Junction[]) ?? [],
  traces: m.traces, builtAt: m.builtAt.toISOString(),
});

export async function getHabits(userId: string, sport: HabitSport): Promise<HabitView | null> {
  const m = await prisma.habitMap.findUnique({ where: { userId_sport: { userId, sport } } });
  return m && toView(m);
}

/** Pour le générateur : grille prête à interroger, classiques et bifurcations. */
export async function loadHabitIndex(userId: string, sport: HabitSport) {
  const h = await getHabits(userId, sport);
  if (!h || !h.cells.length) return null;
  return { heat: new Heat(h.lat0, h.cells, h.cellM), classics: h.classics, junctions: h.junctions, traces: h.traces };
}

/** Sorties d'entraînement avec trace GPS (vélotaf et activités douces exclus). */
async function loadTraces(userId: string, sport: HabitSport): Promise<Trace[]> {
  const acts = await prisma.activity.findMany({
    where: { userId, type: sport, polyline: { not: null } },
    select: { id: true, type: true, startedAt: true, polyline: true, distanceM: true, movingTimeS: true, elevationGainM: true, source: true, dedupeKey: true, title: true },
    orderBy: { startedAt: "desc" },
    take: 1500,
  });
  return acts
    .filter((a) => !isCommute(a))
    .map((a) => ({ id: a.id, startedAt: a.startedAt.toISOString(), pts: decodePolyline(a.polyline!) as LL[], distanceM: a.distanceM, movingTimeS: a.movingTimeS, ascentM: a.elevationGainM }))
    .filter((t) => t.pts.length > 1);
}

/**
 * Recalcule la carte de chaleur, les classiques et les bifurcations d'un sport, puis les enregistre.
 * Les noms de lieux trouvés lors d'un calcul précédent sont gardés ; les nouveaux sont cherchés tant que `deadline` le permet.
 */
export async function buildHabits(userId: string, sport: HabitSport, deadline: number): Promise<HabitView> {
  const [traces, user, prev] = await Promise.all([
    loadTraces(userId, sport),
    prisma.user.findUnique({ where: { id: userId }, select: { homeLat: true } }),
    getHabits(userId, sport),
  ]);
  const starts = traces.map((t) => t.pts[0][0]).sort((a, b) => a - b);
  const lat0 = user?.homeLat ?? starts[starts.length >> 1] ?? 46.6;
  const p = proj(lat0);

  const cells = buildHeat(p, traces);
  const classics = findClassics(p, traces, sport);
  const junctions = findJunctions(p, traces);

  // Noms : repris du calcul précédent quand le lieu n'a pas bougé, sinon cherchés (lieu le plus éloigné du départ, ou carrefour).
  const reuse = <T extends { name: string | null }>(old: T[] | undefined, ll: LL, of: (x: T) => LL) =>
    old?.find((x) => x.name && dist(p, of(x), ll) <= NAME_REUSE_M)?.name ?? null;
  for (const c of classics) c.name = reuse<StoredClassic>(prev?.classics, [c.far.lat, c.far.lng], (x) => [x.far.lat, x.far.lng]);
  for (const j of junctions) j.name = reuse<Junction>(prev?.junctions, [j.lat, j.lng], (x) => [x.lat, x.lng]);
  const missing: { ll: LL; set: (n: string) => void }[] = [
    ...classics.filter((c) => !c.name).map((c) => ({ ll: [c.far.lat, c.far.lng] as LL, set: (n: string) => { c.name = n; } })),
    ...junctions.filter((j) => !j.name).slice(0, 8).map((j) => ({ ll: [j.lat, j.lng] as LL, set: (n: string) => { j.name = n; } })),
  ].slice(0, NAME_BUDGET);
  for (const [i, m] of missing.entries()) {
    if (Date.now() > deadline - 3000) break;
    if (i) await sleep(PHOTON_GAP_MS);
    const place = await placeAt(m.ll[0], m.ll[1]).catch(() => null);
    if (place?.name) m.set(place.name);
  }

  const stored: StoredClassic[] = classics.map(({ pts, ...c }) => ({ ...c, polyline: encodePolyline(pts) }));
  const data = {
    lat0, cellM: CELL_M, traces: traces.length,
    cells: cells as unknown as Prisma.InputJsonValue,
    classics: stored as unknown as Prisma.InputJsonValue,
    junctions: junctions as unknown as Prisma.InputJsonValue,
  };
  const m = await prisma.habitMap.upsert({ where: { userId_sport: { userId, sport } }, update: data, create: { userId, sport, ...data } });
  return toView(m);
}

/** Les deux sports, l'un après l'autre (les noms de lieux se partagent le temps restant). */
export async function buildAllHabits(userId: string, deadline: number) {
  const out: Partial<Record<HabitSport, { traces: number; classics: number; junctions: number }>> = {};
  for (const s of HABIT_SPORTS) {
    const h = await buildHabits(userId, s, deadline);
    out[s] = { traces: h.traces, classics: h.classics.length, junctions: h.junctions.length };
  }
  return out;
}

/** Sorties avec et sans trace GPS, pour la page Habitudes. */
export async function gpsCoverage(userId: string) {
  const [withGps, total] = await Promise.all([
    prisma.activity.count({ where: { userId, type: { in: HABIT_SPORTS }, polyline: { not: null } } }),
    prisma.activity.count({ where: { userId, type: { in: HABIT_SPORTS } } }),
  ]);
  return { withGps, total };
}
