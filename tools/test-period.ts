// Lancer avec : npx tsx tools/test-period.ts
import assert from "node:assert/strict";
import { endOfDay, parsePeriod, periodLabel, periodParams, weeksBetween } from "../lib/analysis/period";
import { dayKey } from "../lib/dates";

const tz = "Europe/Paris", now = new Date("2026-10-23T11:00:00Z"); // vendredi

// Sans paramètre : 12 semaines jusqu'à aujourd'hui, preset reconnu
let p = parsePeriod({}, tz, now);
assert.equal(p.weeks, 12); assert.equal(p.current, true); assert.equal(p.preset, 12);
assert.equal(p.endKey, "2026-10-23"); assert.equal(p.startKey, "2026-08-03"); assert.equal(+p.now, +now);
assert.deepEqual(periodParams(p), { w: "12" });

// Nombre libre, bornes 1 à 104
assert.equal(parsePeriod({ w: "7" }, tz, now).weeks, 7);
assert.equal(parsePeriod({ w: "7" }, tz, now).preset, null);
assert.equal(parsePeriod({ w: "500" }, tz, now).weeks, 104);
assert.equal(parsePeriod({ w: "0" }, tz, now).weeks, 12);
assert.equal(parsePeriod({ w: "abc" }, tz, now).weeks, 12);

// Fin dans le passé : alignée sur le dimanche, `now` = dernier instant de ce dimanche à Paris
p = parsePeriod({ w: "4", to: "2026-06-17" }, tz, now);
assert.equal(p.current, false); assert.equal(p.preset, null);
assert.equal(p.endKey, "2026-06-21"); assert.equal(p.startKey, "2026-05-25");
assert.equal(dayKey(p.now, tz), "2026-06-21");
assert.equal(dayKey(new Date(+p.now + 1000), tz), "2026-06-22");
assert.deepEqual(periodParams(p), { w: "4", to: "2026-06-21" });

// Fin dans la semaine en cours ou dans le futur = période en cours
assert.equal(parsePeriod({ w: "4", to: "2026-10-20" }, tz, now).current, true);
assert.equal(parsePeriod({ w: "4", to: "2027-01-01" }, tz, now).current, true);
assert.equal(parsePeriod({ w: "4", to: "n'importe quoi" }, tz, now).current, true);

// Fin de journée en heure d'hiver comme d'été
assert.equal(endOfDay("2026-12-20", tz).toISOString(), "2026-12-20T22:59:59.000Z");
assert.equal(endOfDay("2026-06-21", tz).toISOString(), "2026-06-21T21:59:59.000Z");

// Semaines entre deux dates (semaines entières, ordre indifférent)
assert.equal(weeksBetween("2026-10-19", "2026-10-25"), 1);
assert.equal(weeksBetween("2026-10-25", "2026-10-26"), 2);
assert.equal(weeksBetween("2026-01-01", "2026-10-23"), 43);
assert.equal(weeksBetween("2026-10-23", "2026-01-01"), 43);
assert.equal(weeksBetween("2020-01-01", "2026-10-23"), 104);

// Libellés
assert.equal(periodLabel({ startKey: "2026-08-03", endKey: "2026-10-23" }), "3 août → 23 oct. 2026");
assert.equal(periodLabel({ startKey: "2025-12-29", endKey: "2026-01-04" }), "29 déc. 2025 → 4 janv. 2026");

console.log("period : OK");
