// Lancer avec : npx tsx tools/test-plan-ribbon.ts
import assert from "node:assert/strict";
import { planRibbon } from "../lib/art/plan-ribbon";
import { RUN_BASE_VMA, weekSessions } from "../lib/training/catalog/run-base-vma";
import { resolveSteps } from "../lib/training/resolve";

const VMA = 15;
const sum = (r: { f: number }[]) => r.reduce((s, x) => s + x.f, 0);
const ribbon = (i: number, n: 2 | 3, week: number) => planRibbon(resolveSteps(weekSessions(week, n)[i].structure, VMA), VMA);

// Footing en endurance (65–75 % de VMA) : une seule zone, Z2 (60–75 %).
const easy = ribbon(1, 3, 2);
assert.deepEqual(easy, [{ z: 2, f: 1 }], "footing = un tronçon Z2");

// VMA courte 8 × 30/30 : échauffement Z2, 8 × (effort Z6 / trot Z1), retour au calme Z2 ; fractions qui somment à 1.
const vma = ribbon(0, 3, 2);
assert.ok(Math.abs(sum(vma) - 1) < 1e-9, "somme = 1");
assert.deepEqual(vma[0].z, 2, "commence par l'échauffement");
assert.equal(vma.at(-1)!.z, 2, "finit par le retour au calme");
assert.equal(vma.filter((s) => s.z === 6).length, 8, "8 efforts à plus de 100 % de VMA");
assert.ok(vma.filter((s) => s.z === 1).length >= 7, "récupérations trottinées en Z1");

// Seuil (85–88 %) : Z4.
const threshold = ribbon(0, 3, 3);
assert.ok(threshold.some((s) => s.z === 4), "le seuil est en Z4");

// Étapes en distance : le poids vient de l'allure (400 m ≈ 1′35 à 100 % de 15 km/h), pas d'une durée inventée.
const fourHundreds = ribbon(0, 3, 7);
const hard = fourHundreds.filter((s) => s.z >= 5).reduce((s, x) => s + x.f, 0);
assert.ok(hard > 0.05 && hard < 0.4, `part dure plausible (${hard.toFixed(2)})`);

// Sans étape : rien. VMA absente : zones par rôle, sans plantage.
assert.deepEqual(planRibbon([], VMA), []);
assert.deepEqual(planRibbon([{ role: "recovery", duration: { type: "time", s: 60 } }, { role: "active", duration: { type: "time", s: 60 } }], 0), [{ z: 1, f: 0.5 }, { z: 2, f: 0.5 }]);

// Toutes les séances du programme ont un ruban qui somme à 1.
for (let w = 1; w <= RUN_BASE_VMA.totalWeeks; w++) for (const n of [2, 3] as const) weekSessions(w, n).forEach((s, i) => {
  const r = planRibbon(resolveSteps(s.structure, VMA), VMA);
  assert.ok(r.length > 0 && Math.abs(sum(r) - 1) < 1e-9, `semaine ${w}, séance ${i}`);
});

console.log("plan-ribbon : ok");
