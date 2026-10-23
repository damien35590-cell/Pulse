// Lancer avec : npx tsx tools/test-records.ts
import assert from "node:assert/strict";
import { buildSportRecords, strengthRecords } from "../lib/analytics/records";
import type { StrengthRow } from "../lib/analytics/strength";

const tz = "Europe/Paris";
const d = (iso: string) => new Date(iso + "T08:00:00Z");
const row = (activityId: string, day: string, name: string, sets: number, reps: number, done: number[], loadKg: number | null = null): StrengthRow =>
  ({ activityId, startedAt: d(day), name, sets, reps, loadKg, setsDetail: done.map((r) => ({ reps: r, loadKg, done: true })) });

// ── Muscu : B1 et B2 ont chacun leur record, le meilleur TOTAL de la variante gagne
const rows = [
  row("a1", "2026-10-05", "B1 - dips", 6, 8, [8, 8, 8, 8, 8, 8]),     // 48
  row("a2", "2026-10-12", "B2 - dips", 6, 8, [8, 8, 8, 8, 6, 5]),     // 43
  row("a3", "2026-10-15", "B2 - dips", 6, 8, [9, 8, 8, 8, 8, 8]),     // 49 → record B2
  row("a4", "2026-10-19", "B2 - dips", 6, 8, [8, 8, 8, 8, 8, 8]),     // 48
  row("a4", "2026-10-19", "Rowing haltère", 3, 10, [10, 10, 8], 20),  // exercice chargé
  row("a3", "2026-10-15", "Rowing haltère", 3, 10, [10, 10, 10], 22), // plus lourd : record
];
const s = strengthRecords(rows, tz);
const b2 = s.find((r) => r.label.includes("B2"))!, b1 = s.find((r) => r.label.includes("B1"))!;
assert.equal(b2.value, "49"); assert.equal(b2.unit, "reps"); assert.equal(b2.activityId, "a3"); assert.equal(b2.sub, "9 max en une série");
assert.equal(b1.value, "48", "B1 ne se mélange pas avec B2");
const row1 = s.find((r) => r.label === "Rowing haltère")!;
assert.equal(row1.value, "22"); assert.equal(row1.unit, "kg × 10"); assert.equal(row1.activityId, "a3");
assert.equal(s.length, 3);

// Séries non faites ou échauffement : ignorés ; un exercice sans aucune série faite n'a pas de record
assert.deepEqual(strengthRecords([{ ...row("x", "2026-10-01", "Pompes", 3, 10, []), setsDetail: [{ reps: 10, loadKg: null, done: false }] }], tz), []);

// ── Endurance : par sport, pas de ligne pour un record absent
const prs = [
  { kind: "BEST_5K", type: "RUN", value: 1229, activityId: "r1", achievedAt: d("2026-06-01") },
  { kind: "BEST_10K", type: "RUN", value: 2758, activityId: "r2", achievedAt: d("2026-06-08") },
  { kind: "LONGEST_DISTANCE", type: "RUN", value: 14200, activityId: "r2", achievedAt: d("2026-06-08") },
  { kind: "LONGEST_DISTANCE", type: "RIDE", value: 110800, activityId: "v1", achievedAt: d("2026-05-01") },
  { kind: "BEST_ELEVATION", type: "RIDE", value: 1234, activityId: "v1", achievedAt: d("2026-05-01") },
  { kind: "LONGEST_DISTANCE", type: "EBIKE", value: 30000, activityId: "e1", achievedAt: d("2026-05-02") },
];
const curves = [
  { activityId: "v1", startedAt: d("2026-05-01"), curve: [900, 600, 450, 300, 250, 220] as (number | null)[] },
  { activityId: "v2", startedAt: d("2026-05-09"), curve: [800, 600, 450, 310, 262.4, null] as (number | null)[] },
  { activityId: "v3", startedAt: d("2026-05-10"), curve: null },
];
const res = buildSportRecords({ tz, prs, curves, strength: rows, counts: { RUN: 40, RIDE: 120, WORKOUT: 30, EBIKE: 300 } });
assert.deepEqual(res.sports.map((x) => x.sport), ["WORKOUT", "RUN", "RIDE"], "pas d'onglet pour un sport sans record, ni pour l'E-bike");
assert.equal(res.defaultSport, "RIDE", "onglet par défaut : le sport le plus pratiqué");
const run = res.sports.find((x) => x.sport === "RUN")!.rows;
assert.deepEqual(run.map((r) => [r.label, r.value, r.unit]), [["Meilleur 5 km", "20:29", ""], ["Meilleur 10 km", "45:58", ""], ["Plus longue sortie", "14,2", "km"]]);
const ride = res.sports.find((x) => x.sport === "RIDE")!.rows;
const sp = (v: string) => v.replace(/\s/g, " "); // fr-FR sépare les milliers par une espace insécable
assert.deepEqual(ride.map((r) => [r.label, sp(r.value), r.unit]), [["Plus longue sortie", "110,8", "km"], ["Plus gros D+", "1 234", "m"], ["Meilleure puissance 20 min", "262", "W"]]);
assert.equal(ride[2].activityId, "v2");
assert.equal(sp(ride[0].day), "1 mai 2026");

// Rien du tout : aucun onglet, pas d'onglet par défaut
assert.deepEqual(buildSportRecords({ tz, prs: [], curves: [], strength: [], counts: {} }), { sports: [], defaultSport: null });

console.log("records : tout est vert");
