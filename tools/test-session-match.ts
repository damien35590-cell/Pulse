// Lancer avec : npx tsx tools/test-session-match.ts
import assert from "node:assert/strict";
import { activityIntensity, fits, isDemanding, pickSession, type MatchSession } from "../lib/training/match";
import { effectiveSessionType, sessionTypesFor, sessionTypeFor } from "../lib/art/session-type";

const sess = (id: string, kind: MatchSession["kind"], isKeySession = false, rejectedActivityIds: string[] = []): MatchSession => ({ id, kind, isKeySession, rejectedActivityIds });
const easyRibbon = [{ z: 1, f: 0.3 }, { z: 2, f: 0.65 }, { z: 4, f: 0.05 }];
const hardRibbon = [{ z: 2, f: 0.5 }, { z: 5, f: 0.3 }, { z: 2, f: 0.2 }];
const easy = { id: "a1", zoneRibbon: easyRibbon }, hard = { id: "a2", zoneRibbon: hardRibbon };

// ── Intensité d'une sortie ──
assert.equal(activityIntensity(easy), "easy");
assert.equal(activityIntensity(hard), "hard");
assert.equal(activityIntensity({ id: "x", isInterval: true }), "hard");
assert.equal(activityIntensity({ id: "x", zoneRibbon: easyRibbon, sessionType: "interval" }), "hard", "le choix manuel prime");
assert.equal(activityIntensity({ id: "x", zoneRibbon: hardRibbon, sessionType: "easy" }), "easy");
assert.equal(activityIntensity({ id: "x" }), "unknown");
// Sans ruban : allure moyenne contre la borne haute de Z2 (75 % de la VMA : 15 km/h de VMA → 11,25 km/h)
assert.equal(activityIntensity({ id: "x", vmaKmh: 15, distanceM: 10000, movingTimeS: 3000 }), "hard", "12 km/h");
assert.equal(activityIntensity({ id: "x", vmaKmh: 15, distanceM: 8000, movingTimeS: 3000 }), "easy", "9,6 km/h");

// ── Séances qui demandent de l'intensité ──
for (const k of ["VMA_TEST", "INTERVALS_SHORT", "INTERVALS_LONG", "THRESHOLD", "FARTLEK", "RACE_PACE"] as const) assert.equal(isDemanding(sess("s", k)), true, k);
for (const k of ["EASY", "RECOVERY", "LONG_RUN"] as const) assert.equal(isDemanding(sess("s", k)), false, k);
assert.equal(isDemanding(sess("s", "LONG_RUN", true)), false, "une sortie longue clé reste de l'endurance");
assert.equal(isDemanding(sess("s", "PROGRESSIVE", true)), true, "séance clé hors endurance");

// ── Un footing facile ne valide pas une séance clé, un fractionné oui ──
assert.equal(fits(sess("s", "VMA_TEST", true), easy), false);
assert.equal(fits(sess("s", "INTERVALS_SHORT", true), easy), false);
assert.equal(fits(sess("s", "INTERVALS_SHORT", true), hard), true);
assert.equal(fits(sess("s", "EASY"), easy), true);
assert.equal(fits(sess("s", "LONG_RUN"), easy), true);
assert.equal(fits(sess("s", "INTERVALS_SHORT", true), { id: "x" }), false, "intensité inconnue : une séance clé n'est pas validée");
assert.equal(fits(sess("s", "EASY"), { id: "x" }), true);

// ── File : la séance clé est sautée pour un footing, la suivante d'endurance est prise ──
const queue = [sess("vma", "VMA_TEST", true), sess("frac", "INTERVALS_SHORT", true), sess("ef", "EASY"), sess("long", "LONG_RUN")];
assert.equal(pickSession(queue, easy)?.id, "ef");
assert.equal(pickSession(queue, hard)?.id, "vma");
assert.equal(pickSession([sess("vma", "VMA_TEST", true)], easy), null, "rien ne convient : pas de liaison");
assert.equal(pickSession([sess("a", "THRESHOLD", true), sess("b", "THRESHOLD", true), sess("c", "THRESHOLD", true), sess("d", "THRESHOLD", true), sess("ef", "EASY")], easy), null, "au-delà de 4 séances, on ne cherche plus");

// ── Paire détachée : jamais reliée de nouveau ──
assert.equal(fits(sess("s", "EASY", false, ["a1"]), easy), false);
assert.equal(fits(sess("s", "EASY", false, ["autre"]), easy), true);
assert.equal(pickSession([sess("ef1", "EASY", false, ["a1"]), sess("ef2", "EASY")], easy)?.id, "ef2");
assert.equal(pickSession([sess("ef1", "EASY", false, ["a1"])], easy), null);

// ── Types de séance par sport ──
const labels = (t: string) => sessionTypesFor(t).map((o) => o.label);
assert.deepEqual(labels("RUN"), ["Footing", "Fractionné", "Sortie longue", "Compétition"]);
assert.deepEqual(labels("RIDE"), ["Récup", "Endurance", "Fractionné", "Sortie longue", "Compétition"]);
assert.deepEqual(labels("HIKE"), []);
assert.equal(sessionTypeFor("RIDE", "easy"), "endurance", "ancien « footing » sur un vélo");
assert.equal(sessionTypeFor("RUN", "recovery"), null);
assert.equal(effectiveSessionType({ type: "RIDE", isInterval: false }), "endurance");
assert.equal(effectiveSessionType({ type: "RUN", isInterval: false }), "easy");
assert.equal(effectiveSessionType({ type: "RIDE", sessionType: "recovery" }), "recovery");
console.log("test-session-match : OK");
