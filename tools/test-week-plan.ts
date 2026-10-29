// Lancer avec : npx tsx tools/test-week-plan.ts
import assert from "node:assert/strict";
import { planLifts, type LiftPlanInput } from "../lib/coach/week-plan";

// Jeudi 29 octobre 2026 : haut du corps fait mardi, cible 3, sortie longue dimanche.
const base: LiftPlanInput = {
  today: "2026-10-29", weekEnd: "2026-11-01", doneDays: ["2026-10-27"], lastKind: "HAUT", lastDay: "2026-10-27",
  target: 3, todayLift: false, runs: [{ day: "2026-11-01", hard: true }],
};

// Rotation : après le haut, le bas, vendredi (pas la veille de la sortie longue : samedi refusé pour le bas).
let p = planLifts(base);
assert.deepEqual(p.placed, [{ day: "2026-10-30", kind: "BAS" }], "bas vendredi ; dimanche = sortie longue, rien de plus ne tient");
assert.equal(p.after, "HAUT", "la suivante de la rotation : le haut");

// Pas de bas la veille d'une séance dure : sans séance vendredi possible (muscu hier), le bas ne va pas samedi.
p = planLifts({ ...base, lastDay: "2026-10-29", doneDays: ["2026-10-27", "2026-10-29"], today: "2026-10-29" });
assert.deepEqual(p.placed, [], "samedi = veille de la sortie longue : pas de bas, dimanche = sortie longue");
assert.equal(p.after, "BAS", "la rotation attend : le bas reste le prochain");

// Haut du corps : doublé possible avec un footing, mais un jour sans course d'abord.
p = planLifts({ ...base, lastKind: "BAS", runs: [{ day: "2026-10-31", hard: false }] });
assert.deepEqual(p.placed.map((x) => x.kind), ["HAUT", "BAS"]);
assert.equal(p.placed[0].day, "2026-10-30", "vendredi, jour sans course");
assert.equal(p.placed[1].day, "2026-11-01", "le bas ne se double pas avec le footing de samedi : dimanche");

// Muscu proposée aujourd'hui par le coach : comptée aujourd'hui, la suivante deux jours après au plus tôt.
p = planLifts({ ...base, todayLift: true, runs: [] });
assert.deepEqual(p.placed, [{ day: "2026-10-29", kind: "BAS" }, { day: "2026-10-31", kind: "HAUT" }]);

// Cible atteinte : rien à placer cette semaine.
assert.deepEqual(planLifts({ ...base, doneDays: ["2026-10-26", "2026-10-27", "2026-10-28"] }).placed, []);

// Jamais le jour d'une séance clé.
p = planLifts({ ...base, lastKind: "BAS", runs: [{ day: "2026-10-31", hard: true }, { day: "2026-10-30", hard: true }] });
assert.ok(p.placed.every((x) => x.day !== "2026-10-30" && x.day !== "2026-10-31"));

console.log("week-plan : OK");
