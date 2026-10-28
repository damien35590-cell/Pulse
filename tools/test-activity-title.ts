// Lancer avec : npx tsx tools/test-activity-title.ts
import assert from "node:assert/strict";
import { displayTitle, planTitle } from "../lib/activity/title";
import { summaryData, type SummaryActivity } from "../lib/activity/summary";

assert.equal(displayTitle({ title: "Morning Run", plannedSession: { title: "VMA courte · 8 × 30/30" } }), "VMA courte · 8 × 30/30", "le nom de la séance prime");
assert.equal(displayTitle({ title: "Morning Run", plannedSession: null }), "Morning Run", "sans séance liée : titre courant");
assert.equal(displayTitle({ title: "Morning Run" }), "Morning Run");
assert.equal(displayTitle({ title: "Morning Run", plannedSession: { title: "  " } }), "Morning Run", "nom vide : repli");
assert.equal(planTitle({ title: "x", plannedSession: { title: "Footing" } }), "Footing");

const base: SummaryActivity = { id: "a", type: "RUN", title: "Morning Run", story: null, startedAt: new Date("2026-10-27T07:00:00Z"), distanceM: 8000, movingTimeS: 2400, elevationGainM: 0, polyline: null };
const linked = summaryData({ ...base, plannedSession: { kind: "EASY", title: "Footing" } }, undefined, "Europe/Paris");
assert.equal(linked.title, "Footing");
assert.match(linked.when, /^Running · /, "le sport passe dans la ligne de la date");
const plain = summaryData(base, undefined, "Europe/Paris");
assert.equal(plain.title, "Morning Run");
assert.ok(!plain.when.startsWith("Running"));
