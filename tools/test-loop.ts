// Lancer avec : npx tsx tools/test-loop.ts
import assert from "node:assert/strict";
import { loopCut, loopReps, loopState } from "../lib/workout/loop";

const pts = (...reps: number[]) => reps.map((r) => ({ reps: r, variant: "B2" as string | null }));

// progrès : total en hausse
assert.equal(loopState(pts(40, 44)), "progress");
assert.equal(loopState(pts(40, 36, 44)), "progress", "un gain remet le compteur à zéro");
// stagne 1/2 : un seul non-gain (égalité ou baisse)
assert.equal(loopState(pts(40, 44, 44)), "stall1");
assert.equal(loopState(pts(40, 44, 41)), "stall1");
assert.equal(loopState(pts(40, 40)), "stall1");
// stagne 2/2 : deux non-gains de suite
assert.equal(loopState(pts(40, 44, 44, 44)), "stall2");
assert.equal(loopState(pts(40, 44, 41, 38)), "stall2");
assert.equal(loopState(pts(40, 44, 44, 44, 44)), "stall2", "reste à 2/2");
// pas de comparaison possible
assert.equal(loopState([]), "new");
assert.equal(loopState(pts(40)), "new");
// un changement de variante repart de zéro
assert.equal(loopState([{ reps: 60, variant: "B1" }, { reps: 60, variant: "B1" }, { reps: 30, variant: "B2" }]), "new");
assert.equal(loopState([{ reps: 60, variant: "B1" }, { reps: 30, variant: "B2" }, { reps: 36, variant: "B2" }]), "progress");

// cible de boucle : −30 % Lafay pur, −20 % hybride ou inconnu, arrondi à l'inférieur
assert.equal(loopCut("lafay"), 0.3);
assert.equal(loopCut("lafay-turbo"), 0.2);
assert.equal(loopCut("superphysique"), 0.2);
assert.equal(loopCut(undefined), 0.2);
assert.equal(loopReps(9, "lafay"), 6, "9 × 0,7 = 6,3 → 6");
assert.equal(loopReps(10, "lafay"), 7, "10 × 0,7 = 7 exactement → 7 (pas 6 par flottant)");
assert.equal(loopReps(8, "lafay"), 5, "5,6 → 5");
assert.equal(loopReps(12, "lafay-turbo"), 9, "9,6 → 9");
assert.equal(loopReps(10, undefined), 8);
assert.equal(loopReps(1, "lafay"), 1, "jamais sous 1");

console.log("loop : ok");
