// Lancer avec : npx tsx tools/test-session-match.ts
import assert from "node:assert/strict";
import { activityIntensity, fits, isDemanding, pickInWeek, pickSession, runShape, type MatchSession, type WeekCandidate } from "../lib/training/match";
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
// ── Semaine : séance du jour, sinon la plus proche de même forme ──
{
  const w = (id: string, kind: MatchSession["kind"], date: string, order: number, min: number, key = false, rejected: string[] = []): WeekCandidate =>
    ({ id, kind, isKeySession: key, rejectedActivityIds: rejected, date, orderInWeek: order, plannedDurationS: min * 60 });
  const week = [w("vma", "INTERVALS_SHORT", "2026-10-27", 1, 45, true), w("foot", "EASY", "2026-10-29", 2, 40), w("long", "LONG_RUN", "2026-11-01", 3, 80)];
  const run = (min: number, ribbon = easyRibbon, id = "r") => ({ id, zoneRibbon: ribbon, movingTimeS: min * 60, distanceM: min * 160 });
  assert.equal(runShape(run(40), "easy", week), "easy");
  assert.equal(runShape(run(75), "easy", week), "long", "au moins 90 % de la sortie longue prévue");
  assert.equal(pickInWeek(week, run(40), "2026-10-29")?.id, "foot", "séance prévue ce jour-là");
  assert.equal(pickInWeek(week, run(40), "2026-10-28")?.id, "foot", "jour sans séance : footing le plus proche (la VMA ne convient pas)");
  assert.equal(pickInWeek(week, run(85), "2026-10-28")?.id, "foot", "un mercredi, tant qu'un footing attend, la sortie longue n'est pas consommée");
  assert.equal(pickInWeek(week, run(85), "2026-10-31")?.id, "long", "un samedi : sortie longue");
  assert.equal(pickInWeek([w("long", "LONG_RUN", "2026-11-01", 3, 80)], run(75), "2026-10-28")?.id, "long", "plus aucun footing à faire : la sortie longue peut être prise en semaine");
  assert.equal(pickInWeek([w("long", "LONG_RUN", "2026-11-01", 3, 80)], run(70), "2026-10-31"), null, "moins de 90 % de la durée prévue : jamais la sortie longue");
  assert.equal(pickInWeek(week, run(45, hardRibbon), "2026-10-30")?.id, "vma", "sortie intense → séance clé, même plus loin");
  assert.equal(pickInWeek(week, run(40), "2026-10-27")?.id, "foot", "séance du jour qui ne convient pas : on cherche ailleurs dans la semaine");
  assert.equal(pickInWeek([w("vma", "INTERVALS_SHORT", "2026-10-27", 1, 45, true)], run(40), "2026-10-27"), null, "rien qui convienne : on laisse la file décider");
  assert.equal(pickInWeek([w("foot", "EASY", "2026-10-29", 2, 40, false, ["r"])], run(40), "2026-10-29"), null, "paire détachée à la main : jamais reliée");
}

// ── Cas réel du 27/10 : mardi midi, 40:29 facile ; semaine : test VMA (mardi), footing 35′ (jeudi), sortie longue 45′ (dimanche) ──
{
  const wk = (id: string, kind: MatchSession["kind"], date: string, order: number, min: number, key = false): WeekCandidate =>
    ({ id, kind, isKeySession: key, rejectedActivityIds: [], date, orderInWeek: order, plannedDurationS: min * 60 });
  const week = [wk("vma", "VMA_TEST", "2026-10-27", 1, 31, true), wk("foot", "EASY", "2026-10-29", 2, 35), wk("long", "LONG_RUN", "2026-11-01", 3, 45)];
  const run = { id: "oct27", zoneRibbon: easyRibbon, movingTimeS: 2429, distanceM: 4530 };
  assert.equal(pickInWeek(week, run, "2026-10-27")?.id, "foot", "le footing de la semaine, pas la sortie longue du dimanche");
  assert.equal(fits(week[2], run), false, "40:29 < 90 % de 45′ : la sortie longue est refusée, même par la file du programme");
}

console.log("test-session-match : OK");
