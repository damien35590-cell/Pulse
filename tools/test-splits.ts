// Lancer avec : npx tsx tools/test-splits.ts
import assert from "node:assert/strict";
import { kmSplits, type SplitPoint } from "../lib/activity/splits";

// Ligne droite vers le nord : 1° de latitude ≈ 111 195 m. Un point tous les 10 m.
const M_PER_DEG = 111_194.93;
const line = (paceSKm: (m: number) => number, meters: number, hr = 150): SplitPoint[] => {
  const pts: SplitPoint[] = [];
  let t = 0;
  for (let m = 0; m <= meters; m += 10) {
    if (m) t += (paceSKm(m) / 1000) * 10 * 1000;
    pts.push({ lat: 48 + m / M_PER_DEG, lng: -1.68, t, hr });
  }
  return pts;
};

const even = kmSplits(line(() => 300, 3000));
assert.equal(even.length, 3, "3 km pleins");
for (const s of even) assert.ok(Math.abs(s.paceS - 300) < 1, `5:00/km : ${s.paceS}`);
assert.deepEqual(even.map((s) => s.km), [1, 2, 3]);
assert.equal(even[0].hr, 150);

const negative = kmSplits(line((m) => (m <= 1000 ? 330 : 290), 2000));
assert.ok(negative[0].paceS > negative[1].paceS + 35, "négatif split visible");

const tail = kmSplits(line(() => 300, 2470));
assert.equal(tail.length, 3, "bout final de 470 m gardé");
assert.equal(tail[2].label, "0,5");
assert.ok(Math.abs(tail[2].paceS - 300) < 2);
assert.equal(kmSplits(line(() => 300, 2100)).length, 2, "bout de 100 m ignoré");

// Pause de 5 min au milieu du 1er km : elle ne compte pas.
const paused = line(() => 300, 2000);
const k = paused.findIndex((p) => p.t >= 150_000);
for (let i = k; i < paused.length; i++) paused[i] = { ...paused[i], t: paused[i].t + 300_000 };
paused.splice(k, 0, { ...paused[k - 1], t: paused[k - 1].t + 299_000 });
assert.ok(Math.abs(kmSplits(paused)[0].paceS - 300) < 2, "pause retirée");

assert.deepEqual(kmSplits([]), []);
console.log("allure par km : ok");
