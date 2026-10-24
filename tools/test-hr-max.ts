// Lancer avec : npx tsx tools/test-hr-max.ts
import assert from "node:assert/strict";
import { combineHrMax, peakHr, tanaka } from "../lib/physio/hr-max";

const flat = (v: number, n: number) => new Array<number>(n).fill(v);

// Meilleure moyenne sur 5 s.
assert.equal(peakHr(flat(150, 120)), 150, "série plate");
assert.equal(peakHr(Array.from({ length: 100 }, (_, i) => 100 + i)), 197, "montée d'un bpm par seconde : (195 + … + 199) / 5");
assert.equal(peakHr([170, 172, 174, 176, 178]), 174);
assert.equal(peakHr([170, 172, 174, 176, 178, 180]), 176, "fenêtre glissante : (172 + … + 180) / 5");
// Un effort court mais réel : montée, palier de 8 s, descente (variations de 5 bpm par seconde).
const effort = [...flat(140, 30), 145, 150, 155, 160, 165, 170, 175, ...flat(180, 8), 175, 170, 165, 160, 155, 150, 145, ...flat(140, 30)];
assert.equal(peakHr(effort), 180, "le palier de 8 s fait une fenêtre pleine à 180");

// Pics de capteur : au-dessus de 220, ou saut de plus de 30 bpm entre deux secondes.
assert.equal(peakHr([...flat(150, 30), 250, ...flat(150, 30)]), 150, "250 bpm écarté");
assert.equal(peakHr([...flat(150, 30), ...flat(221, 5), ...flat(150, 30)]), 150, "plateau au-dessus de 220 écarté");
assert.equal(peakHr([...flat(150, 30), 200, ...flat(150, 30)]), 150, "saut de 50 bpm sur une seconde : pic");
assert.equal(peakHr([...flat(150, 5), ...flat(180, 5)]), 180, "30 bpm d'écart : admis");
assert.equal(peakHr([...flat(150, 5), ...flat(181, 5)]), 150, "31 bpm d'écart : la première seconde est écartée, il reste 4 valeurs");
assert.equal(peakHr([...flat(150, 5), ...flat(181, 6)]), 181, "…et 5 valeurs valides font une fenêtre");
// Trous de capteur (0) : une fenêtre ne traverse pas un trou.
assert.equal(peakHr([170, 170, 0, 170, 170, 170]), null, "aucune fenêtre de 5 s sans trou");
assert.equal(peakHr([170, 170, 170, 0, 170, 170, 170, 170, 170]), 170);
assert.equal(peakHr([]), null);
assert.equal(peakHr(flat(150, 4)), null, "moins de 5 s");

// Tanaka : 208 − 0,7 × âge.
assert.equal(tanaka(30), 187);
assert.equal(tanaka(40), 180);
assert.equal(tanaka(35), 184, "183,5 arrondi");

// Estimation = max(observée, Tanaka) ; sans âge (pas de date de naissance sur User), l'observée seule.
assert.deepEqual(combineHrMax(188), { value: 188, source: "observed", observed: 188, formula: null });
assert.deepEqual(combineHrMax(188, 30), { value: 188, source: "observed", observed: 188, formula: 187 }, "observée plus haute que la formule");
assert.deepEqual(combineHrMax(175, 30), { value: 187, source: "formula", observed: 175, formula: 187 }, "formule plus haute que l'observée");
assert.deepEqual(combineHrMax(187, 30), { value: 187, source: "observed", observed: 187, formula: 187 }, "égalité : l'observée");
assert.deepEqual(combineHrMax(null, 30), { value: 187, source: "formula", observed: null, formula: 187 });
assert.deepEqual(combineHrMax(null), { value: null, source: null, observed: null, formula: null });
assert.equal(combineHrMax(null, null).value, null);
// Hors des bornes de saisie (120–230) : pas une FC max.
assert.equal(combineHrMax(110).value, null, "110 bpm : aucun effort maximal vu");
assert.equal(combineHrMax(110, 30).value, 187);
console.log("FC max estimée : ok");
