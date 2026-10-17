// Lancer avec : npx tsx tools/test-race-bilan.ts
import assert from "node:assert/strict";
import { fmtDelta, pickPrevious, raceBilan, type BilanRace } from "../lib/races/bilan";

const base: BilanRace = { sport: "RUN", targetDistance: 10, goalTimeS: 3000, resultTimeS: 2928, rankOverall: 180, participants: 1000 };

assert.equal(fmtDelta(72), "1 min 12 s");
assert.equal(fmtDelta(48), "48 s");
assert.equal(fmtDelta(120), "2 min");
assert.equal(fmtDelta(3725), "1 h 02 min 05 s");

// Objectif battu de 1 min 12 s, top 18 %, allure 4'53/km vs cible 5'00/km
const b = raceBilan(base, null)!;
assert.equal(b.goal?.text, "Objectif battu de 1 min 12 s 🎉");
assert.ok(b.beaten);
assert.equal(b.percentile?.text, "Top 18 %");
assert.equal(b.pace?.text, "Allure réelle 4'53/km · cible 5'00/km");
assert.equal(b.versus, null);

// Objectif manqué : ton encourageant
const m = raceBilan({ ...base, resultTimeS: 3048 }, null)!;
assert.equal(m.goal?.text, "À 48 s de l’objectif, la prochaine sera la bonne 💪");
assert.ok(!m.beaten);

// Sans objectif ni classement
const n = raceBilan({ ...base, goalTimeS: null, rankOverall: null }, null)!;
assert.equal(n.goal, null);
assert.equal(n.percentile, null);
assert.equal(n.pace?.text, "Allure réelle 4'53/km");
assert.equal(raceBilan({ ...base, resultTimeS: null }, null), null);

// Victoire et top 1 %
assert.equal(raceBilan({ ...base, rankOverall: 1 }, null)!.percentile?.text, "Victoire au général 🏆");
assert.equal(raceBilan({ ...base, rankOverall: 2, participants: 1000 }, null)!.percentile?.text, "Top 1 %");

// Course précédente : la plus récente de distance proche (±15 %), même sport, avec un résultat
const others = [
  { name: "Ancienne", date: "2024-05-01", sport: "RUN", targetDistance: 10, resultTimeS: 3300 },
  { name: "Nouvoitou", date: "2025-06-01", sport: "RUN", targetDistance: 10.5, resultTimeS: 3078 },
  { name: "Marathon", date: "2025-10-01", sport: "RUN", targetDistance: 42, resultTimeS: 14000 },
  { name: "Vélo", date: "2025-09-01", sport: "RIDE", targetDistance: 10, resultTimeS: 1500 },
  { name: "Sans résultat", date: "2025-12-01", sport: "RUN", targetDistance: 10, resultTimeS: null },
];
const prev = pickPrevious(base, others);
assert.equal(prev?.name, "Nouvoitou");
// 10,5 km vs 10 km (5 % d'écart) : comparaison d'allure (3078/10,5 = 293,1 s/km ; 292,8 s/km) → 0 s/km, donc même chrono
const v = raceBilan(base, prev)!;
assert.ok(v.versus?.text.includes("Nouvoitou"));
// Même distance : écart de temps
const v2 = raceBilan(base, { name: "Nouvoitou", date: "2025-06-01", sport: "RUN", targetDistance: 10, resultTimeS: 3078 })!;
assert.equal(v2.versus?.text, "2 min 30 s plus rapide qu’à Nouvoitou");
const v3 = raceBilan(base, { name: "Nouvoitou", date: "2025-06-01", sport: "RUN", targetDistance: 10, resultTimeS: 2900 })!;
assert.equal(v3.versus?.text, "28 s de plus qu’à Nouvoitou, la forme reviendra");
assert.equal(pickPrevious({ sport: "RUN", targetDistance: null }, others), null);

console.log("test-race-bilan : OK");
