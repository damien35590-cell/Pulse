// Lancer avec : npx tsx tools/check-calendar.ts
import assert from "node:assert/strict";
import { monthGrid, shiftMonth, weekOf } from "../lib/calendar";

// Février 2026 : commence un dimanche → la grille démarre le lundi 26 janvier ; finit un samedi → dimanche 1er mars.
let g = monthGrid(2026, 2);
assert.equal(g.start, "2026-01-26"); assert.equal(g.end, "2026-03-01"); assert.equal(g.days.length, 35); assert.equal(g.last, "2026-02-28");

// Février 2027 : lundi 1er → dimanche 28 : exactement 4 semaines.
g = monthGrid(2027, 2);
assert.equal(g.start, "2027-02-01"); assert.equal(g.end, "2027-02-28"); assert.equal(g.weeks, 4);

// Février bissextile 2028 : 29 jours, commence un mardi.
g = monthGrid(2028, 2);
assert.equal(g.last, "2028-02-29"); assert.equal(g.start, "2028-01-31"); assert.equal(g.end, "2028-03-05");

// Mois commençant un dimanche, sur 6 semaines : mars 2026 démarre un dimanche ? (1er mars 2026 = dimanche)
g = monthGrid(2026, 3);
assert.equal(g.start, "2026-02-23"); assert.equal(g.end, "2026-04-05"); assert.equal(g.weeks, 6);

// Toujours lundi en premier, multiples de 7, jours consécutifs.
for (let m = 1; m <= 12; m++) {
  const x = monthGrid(2026, m);
  assert.equal(x.days.length % 7, 0);
  assert.equal(new Date(`${x.start}T00:00:00Z`).getUTCDay(), 1);
  assert.equal(new Date(`${x.end}T00:00:00Z`).getUTCDay(), 0);
}

assert.deepEqual(weekOf("2026-10-17"), ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
console.log("check-calendar : OK");
