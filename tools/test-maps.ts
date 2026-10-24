// Lancer avec : npx tsx tools/test-maps.ts
import assert from "node:assert/strict";
import { previewTrack, project, simplifyTrack, TILE } from "../lib/map/track";
import { tileUrl } from "../lib/map/basemap";
import { climb, distanceTicks, elevationAxis, niceStep } from "../lib/elevation-axis";
import { encodePolyline } from "../lib/polyline";

// ── Web Mercator ──
assert.deepEqual(project([0, 0], 0), [TILE / 2, TILE / 2]);
const [x, y] = project([48.1147, -1.6794], 16);
assert.equal(Math.floor(x / TILE), 32462); // tuile OSM de Rennes au zoom 16
assert.equal(Math.floor(y / TILE), 22750);

// ── Douglas-Peucker : ~200 points max, extrémités gardées, une ligne droite se réduit à 2 points ──
const wiggly = Array.from({ length: 500 }, (_, i) => [48.1 + 0.01 * Math.sin(i / 30) + 0.00003 * Math.sin(i), -1.68 + i * 0.0001] as [number, number]);
const s = simplifyTrack(wiggly);
assert.ok(s.length <= 200 && s.length > 100, `simplifié à ${s.length} points`);
assert.deepEqual(s[0], [48.1, -1.68]);
assert.deepEqual(s[s.length - 1], wiggly[499].map((v) => Math.round(v * 1e5) / 1e5));
assert.equal(simplifyTrack(Array.from({ length: 300 }, (_, i) => [48 + i * 1e-4, -1.6] as [number, number])).length, 2);
assert.equal(simplifyTrack(wiggly.slice(0, 50)).length, 50); // déjà sous la limite : rien n'est retiré
assert.equal(previewTrack(null), undefined); // intérieur / muscu : pas de carte
assert.equal(previewTrack(encodePolyline([[48.1, -1.6]])), undefined);
assert.ok(previewTrack(encodePolyline(wiggly))!.length <= 200);

// ── Tuiles CARTO ──
assert.equal(tileUrl("dark", 16, 32462, 22750), `https://${"abcd"[(32462 + 22750) % 4]}.basemaps.cartocdn.com/dark_all/16/32462/22750.png`);
assert.match(tileUrl("light", 3, 1, 2, true), /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/rastertiles\/voyager\/3\/1\/2@2x\.png$/);

// ── Axe d'altitude : 3 valeurs rondes, jamais depuis 0, données dans l'axe ──
assert.equal(niceStep(17), 20);
assert.equal(niceStep(2.1), 2.5);
for (const [lo, hi] of [[31, 53], [412, 1287], [0.4, 3.2], [1500, 1500], [-12, 8]]) {
  const { ticks, domain } = elevationAxis(lo, hi);
  assert.equal(ticks.length, 3);
  assert.ok(ticks[0] >= domain[0] && ticks[2] <= domain[1], `${ticks} dans l'axe`);
  assert.ok(domain[0] <= lo && domain[1] - domain[0] <= 2.6 * (hi - lo || 10), `axe ${domain} pas trop étiré pour ${lo}–${hi}`);
  assert.ok(domain[0] < ticks[0] && domain[1] > ticks[2] && domain[1] >= hi + (hi - lo) * 0.1);
  if (lo > 100) assert.ok(domain[0] > 0, "l'axe ne part pas de 0");
}
assert.deepEqual(elevationAxis(31, 53).ticks, [35, 40, 45]);
assert.deepEqual(elevationAxis(412, 1287).ticks, [500, 750, 1000]);
assert.deepEqual(elevationAxis(1020, 1890).ticks, [1000, 1500, 2000]);
assert.deepEqual(elevationAxis(5, 620).ticks, [200, 400, 600]);

// ── Repères de distance ──
assert.deepEqual(distanceTicks(3.4).map((t) => t.label), ["0", "1", "2", "3 km"]);
assert.deepEqual(distanceTicks(14).map((t) => t.label), ["0", "2", "4", "6", "8", "10", "12", "14 km"]);
assert.equal(distanceTicks(42.2).at(-1)!.label, "40 km");
assert.deepEqual(distanceTicks(1.2).map((t) => t.label), ["0", "0,5", "1 km"]);
assert.equal(distanceTicks(10).at(-1)!.at, 1);

// ── D+ / D− : le bruit de moins de 3 m ne compte pas ──
assert.deepEqual(climb([10, 11, 10, 11, 10, 11]), { up: 0, down: 0 });
assert.deepEqual(climb([10, 20, 15, 30]), { up: 25, down: 5 });

console.log("test-maps : ok");
