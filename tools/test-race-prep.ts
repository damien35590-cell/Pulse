// Lancer avec : npx tsx tools/test-race-prep.ts
import assert from "node:assert/strict";
import { racePhase, racePrep, targetVolume, prepLine, weeklyGoalKm, type PrepActivity } from "../lib/races/prep";

const now = new Date("2026-10-17T10:00:00Z"); // samedi
const ago = (days: number, km: number, extra: Partial<PrepActivity> = {}): PrepActivity =>
  ({ type: "RUN", startedAt: new Date(+now - days * 864e5), distanceM: km * 1000, movingTimeS: Math.round(km * 330), elevationGainM: 0, ...extra });
const race = (date: string, km: number | null = 14, extra = {}) => ({ date: new Date(`${date}T12:00:00Z`), startTime: "15:00", sport: "RUN", targetDistance: km, targetElevation: null, ...extra });

// ── Phases selon la date ──
assert.equal(racePrep(race("2027-03-27"), [], now).phase, "Base");
assert.equal(racePrep(race("2027-03-27"), [], now).daysLeft, 161);
assert.equal(racePrep(race("2027-03-27"), [], now).weeksLeft, 23);
assert.equal(racePrep(race("2026-11-28"), [], now).phase, "Construction"); // J-42
assert.equal(racePrep(race("2026-11-07"), [], now).phase, "Construction"); // J-21 sur 14 km
assert.equal(racePrep(race("2026-11-07", 42.2), [], now).phase, "Affûtage"); // J-21 sur marathon
assert.equal(racePrep(race("2026-10-27"), [], now).phase, "Affûtage"); // J-10
assert.equal(racePrep(race("2026-10-21"), [], now).phase, "Semaine de course");
assert.equal(racePrep(race("2026-10-17"), [], now).phase, "Jour J");
assert.equal(racePhase(57, 14), "Base");
assert.equal(racePhase(56, 14), "Construction");
assert.equal(racePhase(14, 14), "Affûtage");
assert.equal(racePhase(15, 14), "Construction");

// ── Plus longue sortie (28 j, même sport) ──
const acts = [ago(3, 9), ago(10, 7), ago(40, 15), ago(2, 30, { type: "RIDE" }), ago(5, 6, { type: "WALK" })];
const p = racePrep(race("2027-03-27"), acts, now);
assert.equal(p.longest.km, 9);
assert.equal(Math.round(p.longest.ratio! * 100), 64);
assert.equal(p.longest.next, 11);
assert.ok(p.tips.some((t) => t.includes("64 %") && t.includes("11 km")), "conseil sortie longue");
assert.equal(p.weeks.filter((w) => !w.future).length, 12);
assert.equal(p.weeks.filter((w) => w.future).length, 23); // semaine du 19/10 → semaine du 22/03/2027
assert.equal(p.thisWeek.km, 9); // le vélo et la marche ne comptent pas
assert.equal(p.thisWeek.count, 1);

// ── Volume cible ──
assert.deepEqual(targetVolume("Construction", 14), { lo: 21, hi: 28 });
assert.deepEqual(targetVolume("Construction", 5), { lo: 15, hi: 20 }); // borne min 15 km
assert.deepEqual(targetVolume("Affûtage", 14), { lo: 12.6, hi: 16.8 }); // −40 %
assert.equal(targetVolume("Jour J", 14), null);
assert.equal(weeklyGoalKm(14), 25);
const taper = racePrep(race("2026-10-27"), acts, now);
assert.deepEqual(taper.target, { lo: 12.6, hi: 16.8 });
assert.ok(taper.tips[0].startsWith("Tu es en affûtage"));

// ── Semaines lundi→dimanche à l'heure de Paris : dimanche 23 h 30 UTC = lundi 0 h 30 à Paris ──
const p2 = racePrep(race("2027-03-27"), [{ type: "RUN", startedAt: new Date("2026-10-11T23:30:00Z"), distanceM: 5000, movingTimeS: 1500, elevationGainM: 0 }], now);
assert.equal(p2.thisWeek.km, 5);

// ── Régularité et état ──
const steady = Array.from({ length: 12 }, (_, w) => [ago(w * 7 + 1, 8), ago(w * 7 + 4, 12)]).flat();
const ps = racePrep(race("2026-11-28"), steady, now);
assert.equal(ps.regularity.weeks, 6);
assert.equal(ps.state, "Dans le rythme"); // 20 km/sem. ≈ cible 21-28, longue 12/14 = 86 %
assert.equal(racePrep(race("2026-11-28"), [], now).state, "À relancer");
assert.equal(p.state, "Dans le rythme"); // en base, une reprise légère suffit
assert.equal(racePrep(race("2027-03-27"), [], now).state, "À relancer"); // 6 semaines sans sortie
assert.equal(prepLine(ps), "Construction · Dans le rythme · 20 km cette semaine"); // sorties de vendredi et mardi

// ── D+ et allure cible ──
const trail = racePrep(race("2026-11-28", 14, { targetElevation: 140, goalTimeS: 14 * 300 }), steady, now);
assert.equal(trail.elevation?.target, 140);
assert.ok(trail.tips.some((t) => t.includes("140 m")) || trail.tips.length === 3);
assert.equal(trail.pace?.goal, "5'00/km");
assert.equal(trail.pace?.recent, "5'30/km"); // sorties de 12 km (±30 % de 14 km)
assert.equal(trail.pace?.n, 8); // fenêtre de 8 semaines

console.log("test-race-prep : OK");

// ── En affûtage, jamais « À relancer » ──
assert.equal(racePrep(race("2026-10-24", 25), [], now).state, "Dans le rythme");
console.log("test-race-prep (affûtage) : OK");
