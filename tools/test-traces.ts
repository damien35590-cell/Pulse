// Lancer avec : npx tsx tools/test-traces.ts
import assert from "node:assert/strict";
import { encodePolyline, type LatLng } from "../lib/polyline";
import { buildTracesArt, TRACES_H, TRACES_W } from "../lib/art/traces";

// Boucle carrée de `s` degrés de côté, à partir de (lat, lng)
const loop = (lat: number, lng: number, s: number): LatLng[] => [[lat, lng], [lat, lng + s], [lat + s, lng + s], [lat + s, lng], [lat, lng]];
const input = (id: string, pts: LatLng[], day: string) => ({ id, polyline: encodePolyline(pts), startedAt: new Date(day + "T08:00:00Z") });

// Rien à tracer : pas de trace, pas de vedette
assert.deepEqual(buildTracesArt([]), { paths: [], hero: null, count: 0 });
assert.equal(buildTracesArt([{ id: "x", polyline: "", startedAt: new Date() }, input("y", [[48, 2], [48, 2]], "2026-10-01")]).count, 0, "trace vide ou immobile ignorée");

// Dix sorties de tailles voisines, à des endroits différents, plus une très longue sortie, la plus récente : toutes sur la même origine
const small = Array.from({ length: 10 }, (_, i) => input("s" + i, loop(44 + i, -1 + i, 0.02 + i * 0.002), "2026-10-" + String(i + 1).padStart(2, "0")));
const art = buildTracesArt([...small, input("long", loop(48.1, -1.7, 0.5), "2026-10-20")]);
assert.equal(art.count, 11);
assert.equal(art.paths.length, 10, "la vedette n'est pas répétée dans les traces fines");
assert.ok(art.hero);
const nums = (d: string) => d.slice(1).split("L").map((p) => p.split(",").map(Number));
for (const d of [art.hero!.d, ...art.paths]) {
  const pts = nums(d), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  assert.ok(Math.abs((Math.min(...xs) + Math.max(...xs)) / 2 - TRACES_W / 2) < 0.2, "centrée sur l'origine commune (x)");
  assert.ok(Math.abs((Math.min(...ys) + Math.max(...ys)) / 2 - TRACES_H / 2) < 0.2, "centrée sur l'origine commune (y)");
}
// Vedette : la plus récente QUI TIENT dans la zone (la très longue sortie déborderait) = la dernière des petites
const heroPts = nums(art.hero!.d);
assert.ok(heroPts.every(([x, y]) => x >= 0 && x <= TRACES_W && y >= 0 && y <= TRACES_H), "la vedette est entièrement visible");
assert.deepEqual(art.hero!.end, heroPts[heroPts.length - 1], "le point d'arrivée est le dernier point du chemin");
const span = (d: string) => { const ys = nums(d).map((p) => p[1]); return Math.max(...ys) - Math.min(...ys); };
assert.equal(art.paths.filter((d) => span(d) > TRACES_H).length, 1, "la très longue sortie déborde (échelle commune) : le SVG la coupe");
assert.equal(art.paths.filter((d) => span(d) <= TRACES_H).length, 9, "les autres tiennent dans la zone");

// Une seule sortie : c'est la vedette, aucune trace fine
const solo = buildTracesArt([input("s", loop(48, 2, 0.01), "2026-10-01")]);
assert.equal(solo.paths.length, 0); assert.equal(solo.count, 1);

console.log("traces : tout est vert");
