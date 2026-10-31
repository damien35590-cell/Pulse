// Lancer avec : npx tsx tools/test-warmup.ts
import assert from "node:assert/strict";
import type { StrengthRow } from "../lib/analytics/strength";
import type { LiftExercise } from "../components/workout/set-logger";
import { applyLafayProgress } from "../lib/workout/lafay";
import { reviewSession, sessionTotals, type ReviewInput } from "../lib/workout/session-review";
import { sessionBody } from "../lib/workout/lift";
import { hrStats } from "../lib/workout/hr";
import {
  cleanWarmup, cleanWarmupDefaults, DEFAULT_WARMUP, finishWarmup, liftSamples, runItem, startWarmup, warmupDefaults, warmupLine, warmupPayload, warmupStarted, warmupSummary,
} from "../lib/workout/warmup";

const T0 = Date.parse("2026-10-31T08:00:00Z");
const at = (s: number) => T0 + s * 1000;
let n = 0;
const ids = () => `w${n++}`;

// ── Réglages ──
assert.deepEqual(warmupDefaults(null), DEFAULT_WARMUP, "jamais réglé : corde 3 min + gym 5 min");
assert.deepEqual(DEFAULT_WARMUP, [{ name: "Corde à sauter", min: 3 }, { name: "Gym / mobilité", min: 5 }]);
assert.deepEqual(warmupDefaults([]), [], "liste vide = pas d'échauffement");
assert.deepEqual(cleanWarmupDefaults([{ name: "  Rameur  ", min: 4.4 }, { name: "", min: 3 }, { name: "Vélo", min: 0 }, { name: "Corde", min: 99 }, "x"]), [{ name: "Rameur", min: 4 }]);
assert.equal(cleanWarmupDefaults(Array.from({ length: 20 }, (_, i) => ({ name: `E${i}`, min: 1 }))).length, 8);
assert.equal(warmupSummary(DEFAULT_WARMUP), "Corde à sauter 3 min · Gym / mobilité 5 min");
assert.equal(warmupSummary([]), "Aucun");
assert.equal(startWarmup([]), null, "rien à proposer : pas de bloc");

// ── Chronos : corde 3:05, gym 5:00, puis la séance ──
let w = startWarmup(DEFAULT_WARMUP, ids)!;
assert.equal(w.items[0].targetS, 180);
assert.equal(warmupStarted(w), false);
w = runItem(w, w.items[0].id, at(0));
assert.equal(warmupStarted(w), true);
w = runItem(w, w.items[1].id, at(185)); // « Suivant » : la corde s'arrête, la gym part
assert.deepEqual(w.items.map((x) => [x.elapsedS, x.since]), [[185, null], [0, at(185)]]);
w = finishWarmup(w, at(485));
assert.equal(w.done, true);
const warm = warmupPayload(w, T0, at(1800))!;
assert.deepEqual(warm, { v: 1, items: [{ name: "Corde à sauter", durationS: 185, targetS: 180 }, { name: "Gym / mobilité", durationS: 300, targetS: 300 }], endS: 485 });
assert.equal(warmupLine(warm), "Échauffement 8 min · corde 3 min, gym 5 min");

// ── Passer : rien n'est enregistré ──
const skipped = finishWarmup(runItem(startWarmup(DEFAULT_WARMUP, ids)!, "w2", at(0)), at(40), true);
assert.deepEqual(skipped.items, [], "passé : chronos oubliés");
assert.equal(warmupPayload(skipped, T0, at(600)), undefined);
assert.equal(warmupPayload(finishWarmup(startWarmup(DEFAULT_WARMUP, ids)!, at(0)), T0, at(600)), undefined, "aucun chrono lancé : rien");
assert.equal(warmupPayload(null, T0, at(600)), undefined);
assert.equal(cleanWarmup(undefined, 600), undefined);
assert.equal(cleanWarmup({ items: [] }, 600), undefined);
assert.equal(cleanWarmup({ items: [{ name: "Corde", durationS: 0 }] }, 600), undefined);
assert.equal(warmupLine(null), null, "fiche : pas de ligne");

// ── Serveur : nettoyage ──
assert.deepEqual(cleanWarmup(warm, 1800), warm, "le corps envoyé passe tel quel");
assert.deepEqual(cleanWarmup({ items: [{ name: "Corde", durationS: 90.4, targetS: 99999 }, { name: "", durationS: 30 }], endS: 50 }, 1800), { v: 1, items: [{ name: "Corde", durationS: 90 }], endS: 90 }, "fin jamais avant la somme des chronos");
assert.equal(cleanWarmup({ items: [{ name: "Corde", durationS: 400 }], endS: 400 }, 300)!.endS, 300, "fin dans la séance");

// ── Corps de la séance : l'échauffement n'est jamais un exercice, la durée le compte ──
const ex = (name: string, done: number[]): LiftExercise => ({ name, sets: 3, reps: 8, kg: 0, step: 1, restS: 60, bodyweight: true, prev: [], done: done.map((reps, i) => ({ reps, kg: 0, at: at(600 + i * 90) })) });
const exs = [ex("B1 - dips", [8, 8, 8]), ex("A1 - pompes", [8, 8, 7]), ex("C1 - tractions", [])];
const run = { clientId: "c", title: "Haut du corps", kind: "HAUT", templateId: null, startedAt: T0 };
const withW = sessionBody(run, exs, at(1800), { warmup: w });
const without = sessionBody(run, exs, at(1800), { warmup: skipped });
assert.deepEqual(withW.warmup, warm);
assert.equal("warmup" in without, false, "passé : pas de champ warmup");
assert.deepEqual(withW.exercises, without.exercises, "mêmes exercices avec ou sans échauffement");
assert.deepEqual(withW.exercises.map((e) => e.name), ["B1 - dips", "A1 - pompes"]);
assert.ok(!withW.exercises.some((e) => /corde|gym/i.test(e.name)));
assert.equal(withW.movingTimeS, 1800, "durée : échauffement compris");

// ── Totaux et progression Lafay : identiques avec ou sans échauffement ──
// Ce que le serveur écrit (WorkoutExercise) vient de body.exercises seulement : on rejoue les deux corps.
const asRows = (body: typeof withW, id: string): ReviewInput[] => body.exercises.map((e, i) => ({ id: `${id}-${i}`, activityId: id, name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg, restS: e.restS, comment: null, setsDetail: e.setsDetail }));
const strength = (r: ReviewInput[]): StrengthRow[] => r.map((x) => ({ activityId: x.activityId, startedAt: new Date(T0), name: x.name, sets: x.sets, reps: x.reps, loadKg: x.loadKg, setsDetail: x.setsDetail as StrengthRow["setsDetail"] }));
const a = asRows(withW, "a"), b = asRows(without, "b");
const totals = sessionTotals(reviewSession(a, new Date(T0), new Map()));
assert.deepEqual(totals, sessionTotals(reviewSession(b, new Date(T0), new Map())));
assert.deepEqual(totals, { exercises: 2, sets: 6, reps: 47, seconds: 0 }, "corde et gym ne comptent ni en exercices, ni en séries, ni en reps, ni en secondes");
for (const name of ["B1 - dips", "A1 - pompes"]) {
  const pick = (r: ReviewInput[]) => strength(r).filter((x) => x.name === name);
  assert.deepEqual(applyLafayProgress(pick(a)), applyLafayProgress(pick(b)), `${name} : même cible Lafay`);
}
assert.deepEqual(applyLafayProgress(strength(a).filter((x) => x.name === "B1 - dips"))!.reps, 9, "dips 3×8 réussis : 3×9 la prochaine fois");

// ── FC : enregistrée pendant l'échauffement, moyenne / max sur la muscu seule ──
const series = [...Array.from({ length: 485 }, (_, t) => ({ t, bpm: 165 })), ...Array.from({ length: 600 }, (_, i) => ({ t: 485 + i, bpm: 110 }))];
assert.deepEqual(hrStats(liftSamples(series, warm)), { avg: 110, max: 110 }, "la corde ne gonfle pas la FC de la séance");
assert.equal(liftSamples(series, warm)[0].t, 0, "courbe de la fiche : remise à zéro sur la fin de l'échauffement");
assert.equal(liftSamples(series, null).length, series.length);

console.log("test-warmup : OK");
