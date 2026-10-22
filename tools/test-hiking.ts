// Lancer avec : npx tsx tools/test-hiking.ts
import assert from "node:assert/strict";
import { buildHikingAnalysis, type HikeRow } from "../lib/analytics/hiking";

const tz = "Europe/Paris", now = new Date("2026-10-21T08:00:00Z");
const hike = (id: string, day: string, o: Partial<HikeRow> = {}): HikeRow => ({
  id, title: "Rando " + id, startedAt: new Date(day + "T08:00:00Z"), distanceM: 12000, movingTimeS: 4 * 3600, elevationGainM: 600, avgHr: 130, maxEleM: null, ...o,
});
const base = { last: null, weeks: 12, tz, now };

// Vide : message + dernière rando connue (hors période)
let r = buildHikingAnalysis({ ...base, hikes: [], last: { id: "old", title: "Vieille rando", startedAt: new Date("2025-05-01T08:00:00Z") } });
assert.equal(r.empty, true);
assert.equal(r.last!.id, "old");
assert.equal(r.last!.day, "2025-05-01");
// Une rando hors période ne compte pas
assert.equal(buildHikingAnalysis({ ...base, hikes: [hike("x", "2025-05-01")] }).empty, true);

// Résumé, rythme en montée : 600 m en 4 h = 150 m/h ; 12 km en 4 h = 3 km/h
r = buildHikingAnalysis({ ...base, hikes: [hike("a", "2026-09-12"), hike("b", "2026-10-10", { distanceM: 20000, elevationGainM: 1200, movingTimeS: 6 * 3600, maxEleM: 2100 })] });
assert.equal(r.summary.hikes, 2);
assert.equal(r.summary.km, 32);
assert.equal(r.summary.dPlus, 1800);
assert.equal(r.summary.timeS, 10 * 3600);
assert.equal(Math.round(r.climbRate!), 180, "1800 m en 10 h");
assert.equal(r.hikes[0].climbRate, 150);
assert.equal(r.hikes[0].speedKmh, 3);

// Records
assert.equal(r.records.longest!.id, "b");
assert.equal(r.records.biggestClimb!.value, 1200);
assert.equal(r.records.maxAltitude!.value, 2100, "altitude max seulement si les données existent");
assert.equal(buildHikingAnalysis({ ...base, hikes: [hike("a", "2026-09-12")] }).records.maxAltitude, null);

// Mois : d'août (début de période) à octobre, mois vides à 0
assert.equal(r.monthly[r.monthly.length - 1].label, "oct.");
assert.equal(r.monthly.find((m) => m.month === "2026-09")!.km, 12);
assert.equal(r.monthly.find((m) => m.month === "2026-10")!.dPlus, 1200);
assert.ok(r.monthly.length >= 3);

// Phrases : rythme, repères de dénivelé, meilleur mois ; jamais plus de 3
assert.ok(r.insights.some((t) => t.startsWith("Tu grimpes à 180 m")), r.insights.join(" | "));
assert.ok(r.insights.some((t) => t.startsWith("Ton meilleur mois : octobre")), r.insights.join(" | "));
assert.ok(r.insights.length <= 3);

// Sans dénivelé ni FC : pas de rythme en montée, pas de phrase de montée
r = buildHikingAnalysis({ ...base, hikes: [hike("p", "2026-10-10", { elevationGainM: 0, avgHr: null })] });
assert.equal(r.climbRate, null);
assert.equal(r.hikes[0].climbRate, null);
assert.equal(r.hikes[0].avgHr, null);
assert.equal(r.insights.length, 0);
console.log("test-hiking : ok");
