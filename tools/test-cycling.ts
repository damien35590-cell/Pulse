// Lancer avec : npx tsx tools/test-cycling.ts
import assert from "node:assert/strict";
import { buildCyclingAnalysis, type RideRow, type RideStream } from "../lib/analytics/cycling";

const tz = "Europe/Paris", now = new Date("2026-10-21T08:00:00Z");
const ride = (id: string, day: string, o: Partial<RideRow> = {}): RideRow => ({
  id, startedAt: new Date(day + "T08:00:00Z"), type: "RIDE", title: "Séance", source: "mywhoosh", dedupeKey: null, polyline: null,
  distanceM: 30000, movingTimeS: 3600, elevationGainM: 0, avgPower: 180, avgHr: 140, load: null, curve: null, avgCad: 88, ...o,
});
const zones = { ftp: null, hrMax: 185, ftpManual: false };
const base = { prevRides: [] as RideRow[], commutes: [] as RideRow[], streams: [] as RideStream[], zones, weeks: 4, tz, now };

// Vide
assert.equal(buildCyclingAnalysis({ ...base, rides: [] }).empty, true);

// Résumé : dénivelé masqué pour du home trainer ; affiché dès qu'une sortie extérieure en a
let r = buildCyclingAnalysis({ ...base, rides: [ride("a", "2026-10-14", { elevationGainM: 500 })] });
assert.equal(r.summary.elevationM, null, "home trainer : le dénivelé virtuel ne compte pas");
r = buildCyclingAnalysis({ ...base, rides: [ride("a", "2026-10-14"), ride("b", "2026-10-16", { polyline: "xyz", source: "fit", elevationGainM: 400 })] });
assert.equal(r.summary.elevationM, 400);
assert.equal(r.summary.rides, 2);
assert.equal(r.summary.avgPower, 180);
assert.equal(r.hasLoad, false, "pas de charge : l'option est masquée");

// Sans capteur de puissance : pas de puissance, pas de courbe, pas de zones de puissance
r = buildCyclingAnalysis({ ...base, rides: [ride("n", "2026-10-14", { avgPower: null, avgHr: null })] });
assert.equal(r.summary.avgPower, null);
assert.equal(r.rides.length, 0);
assert.equal(r.bests, null);
assert.equal(r.zones, null);

// Meilleurs efforts : courbe en cache [5 s, 30 s, 1 min, 5 min, 20 min, 1 h]
const curve = (k: number) => [900 * k, 600 * k, 450 * k, 300 * k, 240 * k, null];
r = buildCyclingAnalysis({ ...base, rides: [ride("c", "2026-10-14", { curve: curve(1) })], prevRides: [ride("p", "2026-09-10", { curve: curve(0.95) })] });
assert.equal(r.bests!.find((b) => b.label === "20 min")!.watts, 240);
assert.equal(r.bests!.find((b) => b.label === "20 min")!.prev, 228);
assert.equal(r.ftp.estimated, 228, "FTP = 95 % du meilleur 20 min");
assert.ok(r.insights[0].startsWith("Record sur 5 s"), r.insights.join(" | "));

// Zones de puissance depuis la FTP estimée : 20 min à 240 W → FTP 228, Z1 < 125 W
const power = [...Array(100).fill(100), ...Array(100).fill(200)];
r = buildCyclingAnalysis({ ...base, rides: [ride("z", "2026-10-14", { curve: curve(1) })], streams: [{ id: "z", power, hr: [] }] });
assert.equal(r.zones!.kind, "power");
assert.equal(r.zones!.slices[0].seconds, 100);
assert.equal(r.zones!.slices[0].range, "< 125 W");

// FC à défaut de puissance
r = buildCyclingAnalysis({ ...base, rides: [ride("h", "2026-10-14", { avgPower: null })], streams: [{ id: "h", power: [], hr: Array(200).fill(120) }] });
assert.equal(r.zones!.kind, "hr");

// Efficacité W/bpm : en hausse sur 4 sorties
const eff = ["2026-10-01", "2026-10-05", "2026-10-12", "2026-10-16"].map((d, i) => ride("e" + i, d, { avgPower: 150 + i * 10, avgHr: 140 }));
r = buildCyclingAnalysis({ ...base, rides: eff });
assert.ok(r.efficiency!.changePct! > 5);
assert.ok(r.insights.some((t) => t.includes("progressé")), r.insights.join(" | "));
assert.ok(r.insights.some((t) => t.startsWith("Cadence moyenne : 88")));

// Charge disponible, semaines vides à 0, vélotafs comptés à part
r = buildCyclingAnalysis({ ...base, rides: [ride("l", "2026-10-14", { load: 55 })], commutes: [ride("v", "2026-10-15", { type: "EBIKE", distanceM: 8000 })] });
assert.equal(r.hasLoad, true);
assert.equal(r.weekly.length, 4);
assert.equal(r.footer.commutes, 1);
assert.equal(r.summary.rides, 1, "le vélotaf n'entre pas dans les sorties");
console.log("test-cycling : ok");
