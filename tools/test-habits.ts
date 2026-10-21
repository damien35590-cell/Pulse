// Lancer avec : npx tsx tools/test-habits.ts
import assert from "node:assert/strict";
import {
  angleDiff, bearing, buildHeat, familiarity, findClassics, findJunctions, Heat, junctionText, lengthOf, proj, resample,
  type LL, type Trace,
} from "../lib/habits/grid";
import { classicWhy, detours, familiarText, habitBonus, shortcuts, waypointsOf } from "../lib/habits/plan";

const lat0 = 48.1, P = proj(lat0);
/** Point à (x, y) mètres à l'est / au nord d'un repère. */
const at = (x: number, y: number): LL => [lat0 + y / 110_540, -1.68 + x / P.kx];
const line = (...xy: [number, number][]) => xy.map(([x, y]) => at(x, y));
let n = 0;
const trace = (pts: LL[], days = 0, movingTimeS = 1800): Trace => ({
  id: `a${++n}`, startedAt: new Date(Date.UTC(2026, 9, 20 - days)).toISOString(), pts, distanceM: lengthOf(P, pts), movingTimeS, ascentM: 20,
});
// Petit bruit GPS déterministe (± 6 m).
const noisy = (pts: LL[], s: number) => pts.map(([la, ln], i) => [la + (((i * 7 + s * 13) % 13) - 6) / 110_540, ln + (((i * 5 + s * 11) % 13) - 6) / P.kx] as LL);

// ── Géométrie ──
assert.equal(Math.round(bearing(P, at(0, 0), at(100, 0))), 90, "cap est = 90°");
assert.equal(angleDiff(350, 10), 20);
assert.equal(angleDiff(10, 350), -20);
const rs = resample(P, line([0, 0], [100, 0]), 20);
assert.equal(rs.length, 6, "100 m tous les 20 m : 6 points");

// ── Bifurcation : tout droit vers l'est 1 km, puis 7 fois à gauche (nord), 3 fois à droite (sud) ──
const left = Array.from({ length: 7 }, (_, s) => trace(noisy(line([0, 0], [1000, 0], [1000, 600]), s), s));
const right = Array.from({ length: 3 }, (_, s) => trace(noisy(line([0, 0], [1000, 0], [1000, -600]), s + 7), s + 7));
const forks = [...left, ...right];
const junctions = findJunctions(P, forks);
assert.equal(junctions.length, 1, "un seul carrefour retenu");
const j = junctions[0];
assert.ok(Math.abs(j.lat - at(1000, 0)[0]) * 110_540 < 50 && Math.abs(j.lng - at(1000, 0)[1]) * P.kx < 50, "carrefour placé à ±50 m");
assert.equal(Math.round(j.approach / 10) * 10, 90, "arrivée par l'ouest (cap est)");
assert.deepEqual(j.branches.map((b) => [b.turn, b.count]), [["left", 7], ["right", 3]]);
assert.equal(junctionText(j), "Tu prends à gauche 7 fois sur 10");

// Simple chemin commun (aucune séparation) : pas de bifurcation.
assert.equal(findJunctions(P, Array.from({ length: 6 }, (_, s) => trace(noisy(line([0, 0], [2000, 0]), s)))).length, 0);

// ── Carte de chaleur et familiarité ──
const heat = new Heat(lat0, buildHeat(P, forks));
assert.equal(heat.at(at(500, 0)), 10, "les 10 sorties passent sur le tronc commun");
assert.equal(heat.at(at(1000, 400)), 7);
assert.equal(heat.at(at(3000, 3000)), 0);
assert.equal(familiarity(heat, resample(P, line([0, 0], [1000, 0]), 50)), 1);
assert.ok(familiarity(heat, resample(P, line([0, 0], [0, 2000]), 50)) < 0.1, "chemin jamais pris");

// ── Classiques : 4 fois la même boucle, 2 fois une autre, 1 sortie isolée ──
const loopA = line([0, 0], [1500, 0], [1500, 1500], [0, 1500], [0, 0]);
const loopB = line([0, 0], [-2000, 0], [-2000, -800], [0, -800], [0, 0]);
const runs = [
  ...Array.from({ length: 4 }, (_, s) => trace(noisy(loopA, s), s * 3, 1800 + s * 30)),
  // Même boucle parcourue dans l'autre sens : même classique.
  trace(noisy([...loopA].reverse(), 9), 20, 1750),
  ...Array.from({ length: 2 }, (_, s) => trace(noisy(loopB, s), s * 2 + 1)),
  trace(line([0, 0], [0, 4000], [4000, 4000], [0, 0]), 5),
];
const classics = findClassics(P, runs, "RUN");
assert.equal(classics.length, 1, "seule la boucle faite au moins 3 fois est un classique");
const c = classics[0];
assert.equal(c.count, 5);
assert.ok(c.loop, "revient au départ");
assert.equal(c.bestMovingS, 1750);
assert.ok(Math.abs(c.distanceM - 6000) < 200, `longueur ≈ 6 km (${c.distanceM})`);
assert.ok(Math.abs(c.far.lat - at(1500, 1500)[0]) * 110_540 < 100, "point le plus éloigné : le coin opposé");
assert.equal(c.lastAt, runs[0].startedAt);

// ── Variantes des classiques ──
const { wps, cum, len } = waypointsOf(P, loopA);
assert.ok(Math.abs(len - 6000) < 50 && wps.length >= 14 && wps.length <= 46, "points de passage tous les ~400 m, 45 au plus");
const cuts = shortcuts(P, wps, cum, 2000);
assert.ok(cuts.length > 0, "un raccourci existe sur un carré de 1,5 km");
assert.ok(cuts.every((c) => c.i >= 1 && c.j <= wps.length - 2), "le départ et l'arrivée restent sur le tracé");
assert.ok(cuts[0].saving >= 800, "économise au moins 40 % de la distance voulue");
assert.ok(cuts.every((c, k) => !k || Math.abs(c.saving - 2000) >= Math.abs(cuts[0].saving - 2000)), "le plus proche des 2 km voulus d'abord");
// Bifurcation dont une branche quitte le tracé : détour proposé par elle en premier (sauf en Découverte).
const fork = { id: "j", lat: at(1500, 750)[0], lng: at(1500, 750)[1], approach: 0, total: 6, name: null, branches: [
  { lat: at(1500, 910)[0], lng: at(1500, 910)[1], bearing: 0, count: 4, turn: "straight" as const },
  { lat: at(1660, 750)[0], lng: at(1660, 750)[1], bearing: 90, count: 2, turn: "right" as const },
] };
const d = detours(P, wps, 1500, [fork], heat, "habit");
assert.ok(d[0].junction, "détour par la branche de la bifurcation");
assert.ok(d[0].via[1] > at(1500, 0)[1], "vers l'est, hors du tracé");
assert.ok(detours(P, wps, 1500, [fork], heat, "discover").every((x) => !x.junction));
// Curseur et textes.
assert.ok(habitBonus("habit", 0.8) > 0 && habitBonus("discover", 0.8) < 0 && habitBonus("balanced", 0.8) === 0);
assert.equal(familiarText("discover", 0.15), "85 % de chemins nouveaux");
assert.equal(familiarText("habit", 0.72), "72 % sur tes chemins habituels");
assert.equal(familiarText("balanced", 0.4), null);
assert.equal(classicWhy({ classicId: "c", name: "Étang de Paimpont", count: 14, kind: "longer", deltaMin: 9, viaName: "Moulin du Pont", viaJunction: true, loop: true }),
  "Boucle vers Étang de Paimpont · faite 14 fois · +9 min par la bifurcation que tu prends parfois vers Moulin du Pont");

console.log("test-habits : OK");
