// Lancer avec : npx tsx tools/test-workout.ts
import assert from "node:assert/strict";
import type { StrengthRow } from "../lib/analytics/strength";
import { applyLafayProgress } from "../lib/workout/lafay";
import { kindOfNames, nextKind } from "../lib/workout/kind";
import { defaultVariant, displayName, resolveName, restAfterFor, variantsOf } from "../lib/workout/catalog";
import { planExercise, type Structure } from "../lib/workout/draft";

const d = (iso: string) => new Date(iso + "T08:00:00Z");
const row = (id: string, day: string, name: string, sets: number, reps: number, done: number[], loadKg: number | null = null): StrengthRow =>
  ({ activityId: id, startedAt: d(day), name, sets, reps, loadKg, setsDetail: done.map((r) => ({ reps: r, loadKg, done: true })) });
const six = (n: number) => [n, n, n, n, n, n];

// ── Noms et échelles ──
assert.deepEqual(resolveName("B2 - dips"), { code: "B", variant: "B2", name: "B2 - dips" });
assert.deepEqual(resolveName("c - tractions"), { code: "C", variant: "C", name: "C - tractions" }, "« C » seul = forme finale de l'échelle");
assert.deepEqual(resolveName("F"), { code: "F", variant: null, name: "F - squat sauté" });
assert.deepEqual(resolveName(" Développé couché "), { code: "Développé couché", variant: null, name: "Développé couché" });
assert.deepEqual(variantsOf("B"), ["B1", "B2", "B"]);
assert.deepEqual(variantsOf("A"), ["A1", "A2", "A3", "A4", "A5", "A6"]);
assert.deepEqual(variantsOf("G"), []);
assert.equal(defaultVariant("C"), "C1");
assert.equal(defaultVariant("F"), null);
assert.equal(displayName("H", null), "H - relevés de genoux");
assert.equal(restAfterFor(30), 120, "séries courtes : 2 min avant l'exercice suivant");
assert.equal(restAfterFor(90), 90);

// ── Haut / bas ──
assert.equal(kindOfNames(["B2 - dips", "A1 - pompes", "C1 - tractions"]), "HAUT");
assert.equal(kindOfNames(["F - squat sauté", "G - crunch", "H - relevés de genoux"]), "BAS");
assert.equal(kindOfNames(["B2 - dips", "F - squat sauté"]), "LIBRE", "mélangé");
assert.equal(kindOfNames([]), "LIBRE");
assert.equal(kindOfNames(["Développé couché", "Squat", "Leg press"]), "BAS", "2 contre 1 : le bas domine d'au moins 50 %");
assert.equal(nextKind("HAUT"), "BAS");
assert.equal(nextKind("BAS"), "HAUT");
assert.equal(nextKind("LIBRE"), "HAUT");
assert.equal(nextKind(null), "HAUT");

// ── applyLafayProgress : les cibles ne sont jamais recopiées ──
assert.equal(applyLafayProgress([]), null);
// Toutes les séries à la cible (6×8) → +1 rep : 6×9, même niveau.
let t = applyLafayProgress([row("a", "2026-10-12", "B1 - dips", 6, 8, six(8))])!;
assert.deepEqual([t.variant, t.sets, t.reps, t.change], ["B1", 6, 9, "progress"]);
// Cible ratée (8·8·8·7·6·5 = 42 sur 6×8) → même cible.
t = applyLafayProgress([row("a", "2026-10-12", "B1 - dips", 6, 8, [8, 8, 8, 7, 6, 5])])!;
assert.deepEqual([t.variant, t.reps, t.change], ["B1", 8, "repeat"]);
// Plafond de 12 atteint partout → niveau suivant à arrondi(12 × 0,7) = 8.
t = applyLafayProgress([row("a", "2026-10-12", "B1 - dips", 6, 12, six(12))])!;
assert.deepEqual([t.variant, t.reps, t.change, t.hint], ["B2", 8, "evolve", "passe à B2 à 6×8"]);
// Plafond visé mais pas atteint partout → on réessaie, sans changer de niveau.
t = applyLafayProgress([row("a", "2026-10-12", "B1 - dips", 6, 12, [12, 12, 11, 11, 10, 10])])!;
assert.deepEqual([t.variant, t.reps, t.change], ["B1", 12, "repeat"]);
// Deux séances sans progrès (total égal, cible non atteinte) → niveau suivant à 70 %.
t = applyLafayProgress([
  row("c", "2026-10-19", "B2 - dips", 6, 10, [9, 9, 8, 8, 7, 7]),
  row("b", "2026-10-15", "B2 - dips", 6, 10, [9, 9, 8, 8, 7, 7]),
  row("a", "2026-10-12", "B2 - dips", 6, 10, six(10)),
])!;
assert.deepEqual([t.variant, t.reps, t.change], ["B", 7, "evolve"]);
// Forme finale bloquée deux fois → on repart à 70 % sur le même niveau.
t = applyLafayProgress([
  row("c", "2026-10-19", "B - dips", 6, 10, [9, 9, 8, 8, 7, 7]),
  row("b", "2026-10-15", "B - dips", 6, 10, [9, 9, 8, 8, 7, 7]),
  row("a", "2026-10-12", "B - dips", 6, 10, six(10)),
])!;
assert.deepEqual([t.variant, t.reps, t.change], ["B", 7, "restart"]);
// Squat sauté : plafond à 20, puis « saute plus haut ».
t = applyLafayProgress([row("a", "2026-10-12", "F - squat sauté", 6, 20, six(20))])!;
assert.deepEqual([t.reps, t.change, t.hint], [20, "repeat", "saute plus haut"]);
t = applyLafayProgress([row("a", "2026-10-12", "F - squat sauté", 6, 15, six(15))])!;
assert.equal(t.reps, 16, "le plafond du squat sauté est 20, pas 12");

// ── planExercise : structure + historique → cible du jour ──
const base: Structure = { code: "B", variant: "B1", sets: 6, reps: 8, restSec: 30, restAfterSec: 120, loadKg: null, note: null };
// Sans historique : la structure fait foi.
let p = planExercise(base, []);
assert.deepEqual([p.name, p.variant, p.sets, p.reps, p.last], ["B1 - dips", "B1", 6, 8, null]);
// Avec historique : cible recalculée (8 → 9), pas recopiée ; « dernière fois » = reps par série + total.
p = planExercise({ ...base, reps: 5 }, [row("a", "2026-10-12", "B1 - dips", 6, 8, six(8))]);
assert.equal(p.reps, 9);
assert.deepEqual(p.last?.reps, six(8));
assert.equal(p.last?.total, 48);
assert.equal(p.last?.variant, "B1");
// Le niveau suit l'historique, pas le modèle : B2 fait la dernière fois alors que le modèle dit B1.
p = planExercise(base, [row("a", "2026-10-12", "B2 - dips", 6, 10, [10, 10, 10, 9, 9, 9])]);
assert.deepEqual([p.variant, p.name, p.reps], ["B2", "B2 - dips", 10]);
assert.equal(p.last?.total, 57);
// Le conseil de changement de niveau parle des séries du modèle (6), pas de celles de la dernière séance (3).
p = planExercise(base, [row("a", "2026-10-12", "B1 - dips", 3, 12, [12, 12, 12])]);
assert.deepEqual([p.variant, p.reps, p.hint], ["B2", 8, "passe à B2 : 6×8"]);
// Le repos vient de la structure.
assert.deepEqual([p.restSec, p.restAfterSec], [30, 120]);
// Exercice libre chargé : double progression (+1 rep par série).
p = planExercise({ code: "Squat", variant: null, sets: 3, reps: 5, restSec: 90, restAfterSec: 90, loadKg: 60, note: null }, [row("s", "2026-10-12", "Squat", 3, 8, [8, 8, 8], 60)]);
assert.deepEqual([p.name, p.variant, p.reps, p.loadKg], ["Squat", null, 9, 60]);
// Une seule ligne de la séance la plus récente compte pour « dernière fois », même si l'exercice y figure deux fois.
p = planExercise(base, [row("z", "2026-10-12", "B2 - dips", 3, 8, [8, 8, 8]), row("z", "2026-10-12", "B2 - dips", 3, 8, [7, 7, 7]), row("y", "2026-10-05", "B2 - dips", 6, 8, six(6))]);
assert.equal(p.last?.reps.length, 6);

console.log("workout : OK");
