// Lancer avec : npx tsx tools/test-lafay-test.ts
import assert from "node:assert/strict";
import type { StrengthRow } from "../lib/analytics/strength";
import { groupKey } from "../lib/analytics/strength";
import { applyLafayProgress } from "../lib/workout/lafay";
import { planExercise } from "../lib/workout/draft";
import { reviewSession, sessionTotals, type ReviewInput } from "../lib/workout/session-review";
import { libraryTemplate } from "../lib/workout/library";
import {
  applyPlan, cleanResult, deltas, DIPS_KEY, improved, levelFromB, resetDipsHistory, targetText, TEST_ORDER, TEST_REST_S, tome2Start, TOME2_TABLE,
} from "../lib/workout/lafay-test";

// ── Ordre et repos (tome 1 p. 39) ──
assert.deepEqual([...TEST_ORDER], ["A", "B", "C", "A1"]);
assert.equal(TEST_REST_S, 180);

// ── Niveau d'après B : bornes 4/5 et 7/8 ──
assert.equal(levelFromB(0).id, "lafay-n1-p1");
assert.equal(levelFromB(4).id, "lafay-n1-p1", "4 dips : niveau 1, programme 1");
assert.equal(levelFromB(5).id, "lafay-n1-p2", "5 dips : niveau 1, programme 2");
assert.equal(levelFromB(7).id, "lafay-n1-p2", "7 dips : niveau 1, programme 2");
assert.equal(levelFromB(8).id, "lafay-n2", "8 dips : niveau 2");
assert.equal(levelFromB(60).id, "lafay-n2");
// Les mêmes seuils que les modèles du catalogue (catalog-data.ts) : la règle ne contredit pas le dépôt.
assert.match(libraryTemplate("lafay-n1-p1")!.progression, /0 à 4 dips au test B/);
assert.match(libraryTemplate("lafay-n1-p2")!.progression, /5 à 7 dips au test B/);
for (const b of [0, 4, 5, 7, 8]) assert.ok(libraryTemplate(levelFromB(b).id), `modèle ${levelFromB(b).id} présent`);

// ── Tableau du tome 2 : chaque borne ──
const t2 = (b: number) => tome2Start(b)?.reps ?? null;
assert.equal(t2(8), null, "8 dips : niveau 2 mais pas de valeur dans le tableau");
assert.equal(t2(9), null);
const bounds: [number, number | null][] = [[9, null], [10, 5], [14, 5], [15, 6], [19, 6], [20, 8], [24, 8], [25, 10], [29, 10], [30, 11], [34, 11], [35, 13], [39, 13], [40, 15], [80, 15]];
for (const [b, reps] of bounds) assert.equal(t2(b), reps, `B = ${b}`);
assert.deepEqual(tome2Start(22), { sets: 6, reps: 8 });
assert.equal(TOME2_TABLE.length, 7);

// ── Écarts au test précédent, « Bravo » seulement si une valeur le bat ──
const cur = { A: 22, B: 9, C: 6, A1: 14 }, prev = { A: 20, B: 9, C: 7, A1: 14 };
assert.deepEqual(deltas(cur, prev), { A: 2, B: 0, C: -1, A1: 0 });
assert.deepEqual(improved(deltas(cur, prev)), ["A"]);
assert.deepEqual(improved(deltas(prev, prev)), [], "rien de battu : pas de Bravo");
assert.equal(deltas(cur, null), null);

// ── Ce que « Appliquer » change : les dips seulement, d'après le modèle du niveau ──
const n1p1 = applyPlan(3);
assert.equal(n1p1.kind, "none", "niveau 1 programme 1 : pas de dips au modèle, rien à appliquer");
const n1p2 = applyPlan(6);
assert.ok(n1p2.kind === "dips");
assert.deepEqual({ v: n1p2.after.variant, s: n1p2.after.sets, r: n1p2.after.restSec, from: n1p2.repsFrom }, { v: "B", s: 3, r: 120, from: "max" }, "B en amplitude complète, 3 × max, 2 min");
const n2low = applyPlan(9);
assert.ok(n2low.kind === "dips");
assert.deepEqual({ v: n2low.after.variant, s: n2low.after.sets, reps: n2low.after.reps, from: n2low.repsFrom }, { v: "B1", s: 6, reps: 5, from: "template" }, "8–9 dips : modèle niveau 2, B1 6 × 5");
const n2 = applyPlan(22);
assert.ok(n2.kind === "dips");
assert.deepEqual({ v: n2.after.variant, s: n2.after.sets, reps: n2.after.reps, rest: n2.after.restSec, from: n2.repsFrom }, { v: "B1", s: 6, reps: 8, rest: 25, from: "tome2" });
assert.equal(targetText(n2.after), "B1 · 6 × 8");
assert.equal(targetText(n1p2.after, true), "B · 3 × max");

// ── Saisie ──
assert.deepEqual(cleanResult({ A: "22", B: 9.4, C: 0, A1: 14 }), { A: 22, B: 9, C: 0, A1: 14 });
assert.equal(cleanResult({ A: 22, B: 9, C: 6 }), null, "A1 manquant");
assert.equal(cleanResult({ A: -1, B: 9, C: 6, A1: 1 }), null);

// ── Un test n'est pas une séance : progression Lafay et totaux ──
const day = (iso: string) => new Date(iso + "T08:00:00Z");
const row = (id: string, d: string, name: string, sets: number, reps: number, done: number[]): StrengthRow =>
  ({ activityId: id, startedAt: day(d), name, sets, reps, loadKg: null, setsDetail: done.map((r) => ({ reps: r, loadKg: null, done: true })) });
const dips = [row("s2", "2026-10-28", "B2 - dips", 6, 9, [9, 9, 9, 9, 9, 9]), row("s1", "2026-10-25", "B2 - dips", 6, 8, [8, 8, 8, 8, 8, 8])];
const push = [row("s2", "2026-10-28", "A3 - pompes serrées", 6, 10, [10, 10, 10, 10, 10, 10])];
assert.equal(groupKey("B2 - dips"), DIPS_KEY, "la clé des dips est celle de l'historique");
const history = new Map([[DIPS_KEY, dips], [groupKey("A3 - pompes serrées")!, push]]);

// Rien d'appliqué : un test (même enregistré) ne change ni la cible ni l'historique : il n'y entre pas.
assert.equal(resetDipsHistory(history, null), history);
assert.deepEqual(applyLafayProgress(resetDipsHistory(history, null).get(DIPS_KEY)!), applyLafayProgress(dips));
assert.equal(applyLafayProgress(dips)!.reps, 10, "sans test appliqué : B2 6 × 10, d'après les séances");

// Test appliqué le 30 : les dips d'avant ne comptent plus, la cible appliquée fait foi ; les pompes ne bougent pas.
const after = resetDipsHistory(history, day("2026-10-30"));
assert.equal(after.has(DIPS_KEY), false);
assert.equal(applyLafayProgress(after.get(DIPS_KEY) ?? []), null);
assert.deepEqual(after.get(groupKey("A3 - pompes serrées")!), push, "les autres exercices gardent leur historique");
const structure = { code: "B", variant: n2.after.variant, sets: n2.after.sets, reps: n2.after.reps, restSec: n2.after.restSec, restAfterSec: n2.after.restAfterSec, loadKg: null, note: n2.after.note };
const next = planExercise(structure, after.get(DIPS_KEY) ?? []);
assert.deepEqual({ v: next.variant, s: next.sets, r: next.reps }, { v: "B1", s: 6, r: 8 }, "prochaine séance : la cible appliquée");
// Une séance de dips faite après le test reprend la main (progression Lafay normale).
const later = resetDipsHistory(new Map([[DIPS_KEY, [row("s3", "2026-11-02", "B1 - dips", 6, 8, [8, 8, 8, 8, 8, 8]), ...dips]]]), day("2026-10-30"));
assert.equal(later.get(DIPS_KEY)!.length, 1);
assert.deepEqual({ v: applyLafayProgress(later.get(DIPS_KEY)!)!.variant, r: applyLafayProgress(later.get(DIPS_KEY)!)!.reps }, { v: "B1", r: 9 });

// Totaux d'une séance : ils ne lisent que ses exercices ; un test n'en crée aucun.
const ex = (id: string, name: string, done: number[]): ReviewInput => ({ id, activityId: "s2", name, sets: done.length, reps: 9, loadKg: null, restS: 25, comment: null, setsDetail: done.map((r) => ({ reps: r, loadKg: null, done: true })) });
const session = [ex("e1", "B2 - dips", [9, 9, 9, 9, 9, 9]), ex("e2", "A3 - pompes serrées", [10, 10, 10, 10, 10, 10])];
assert.deepEqual(sessionTotals(reviewSession(session, day("2026-10-28"), new Map())), { exercises: 2, sets: 12, reps: 114, seconds: 0 });

console.log("test de niveau Lafay : OK");
