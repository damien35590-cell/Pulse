// Lancer avec : npx tsx tools/test-race-match.ts
import assert from "node:assert/strict";
import { findRaceActivity, type MatchActivity } from "../lib/races/match";

type A = MatchActivity & { id: string };
const act = (id: string, type: string, iso: string, km: number): A => ({ id, type, startedAt: new Date(iso), distanceM: km * 1000 });
const race = (extra = {}) => ({ date: new Date("2026-10-11T12:00:00Z"), startTime: "09:30", sport: "RUN", targetDistance: 10 as number | null, ...extra });
// 11 octobre 2026 : Paris = UTC+2 → départ 09:30 locale = 07:30Z.

// ── Une bonne activité parmi un vélotaf, une marche et un footing de 5 km le même jour ──
const day: A[] = [
  act("velotaf", "RIDE", "2026-10-11T05:50:00Z", 10),
  act("marche", "WALK", "2026-10-11T07:30:00Z", 10),
  act("footing5", "RUN", "2026-10-11T15:00:00Z", 5),
  act("course", "RUN", "2026-10-11T07:32:00Z", 10.2),
];
assert.equal(findRaceActivity(race(), day)?.id, "course");
assert.equal(findRaceActivity(race(), day.filter((a) => a.id !== "course")), null, "ni vélo, ni marche, ni footing court");

// ── Veille ou lendemain : aucune correspondance (jour local Paris) ──
assert.equal(findRaceActivity(race(), [act("veille", "RUN", "2026-10-10T07:30:00Z", 10)]), null);
assert.equal(findRaceActivity(race(), [act("lendemain", "RUN", "2026-10-12T07:30:00Z", 10)]), null);
// 00:30 locale le 12 = 22:30Z le 11 : toujours le lendemain à Paris.
assert.equal(findRaceActivity(race({ startTime: null }), [act("minuit", "RUN", "2026-10-11T22:30:00Z", 10)]), null);

// ── Fenêtre d'heure : −45 min / +3 h ──
assert.equal(findRaceActivity(race(), [act("t", "RUN", "2026-10-11T06:46:00Z", 10)])?.id, "t"); // 44 min avant
assert.equal(findRaceActivity(race(), [act("t", "RUN", "2026-10-11T06:44:00Z", 10)]), null); // 46 min avant
assert.equal(findRaceActivity(race(), [act("t", "RUN", "2026-10-11T10:29:00Z", 10)])?.id, "t"); // 2 h 59 après
assert.equal(findRaceActivity(race(), [act("t", "RUN", "2026-10-11T10:31:00Z", 10)]), null);
// Sans heure de départ : toute la journée convient.
assert.equal(findRaceActivity(race({ startTime: null }), [act("soir", "RUN", "2026-10-11T17:00:00Z", 10)])?.id, "soir");

// ── Distance : 75 % à 130 % de l'objectif ──
assert.equal(findRaceActivity(race(), [act("d", "RUN", "2026-10-11T07:30:00Z", 7.5)])?.id, "d");
assert.equal(findRaceActivity(race(), [act("d", "RUN", "2026-10-11T07:30:00Z", 7.4)]), null);
assert.equal(findRaceActivity(race(), [act("d", "RUN", "2026-10-11T07:30:00Z", 13)])?.id, "d");
assert.equal(findRaceActivity(race(), [act("d", "RUN", "2026-10-11T07:30:00Z", 13.1)]), null);
assert.equal(findRaceActivity(race({ targetDistance: null }), [act("d", "RUN", "2026-10-11T07:30:00Z", 3)])?.id, "d", "distance inconnue : pas de filtre");

// ── Deux sorties candidates : la plus proche en distance, puis en heure ──
const two: A[] = [act("loin", "RUN", "2026-10-11T07:30:00Z", 12.4), act("proche", "RUN", "2026-10-11T09:00:00Z", 10.1)];
assert.equal(findRaceActivity(race(), two)?.id, "proche");
const same: A[] = [act("tard", "RUN", "2026-10-11T09:20:00Z", 10.05), act("juste", "RUN", "2026-10-11T07:35:00Z", 10.1)];
assert.equal(findRaceActivity(race(), same)?.id, "juste", "distances équivalentes (< 1 %) : l'heure départage");

// ── Rando : la marche compte aussi, pas la course à pied ──
const hike = race({ sport: "HIKE", targetDistance: 15, startTime: "08:00" });
assert.equal(findRaceActivity(hike, [act("m", "WALK", "2026-10-11T06:00:00Z", 15), act("r", "RUN", "2026-10-11T06:00:00Z", 15)])?.id, "m");
// Heure d'hiver : 08:00 locale = 07:00Z.
const winter = race({ date: new Date("2027-01-17T12:00:00Z"), startTime: "08:00" });
assert.equal(findRaceActivity(winter, [act("w", "RUN", "2027-01-17T07:05:00Z", 10)])?.id, "w");

console.log("test-race-match : OK");
