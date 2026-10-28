// Lancer avec : npx tsx tools/test-fitness.ts
import assert from "node:assert/strict";
import { formDeltaTone } from "../lib/fitness";

// Écart de fitness sur 7 jours (tuile Forme de l'accueil) : la couleur suit ce que le changement veut dire, jamais rouge.
assert.equal(formDeltaTone(3, -15), "good", "hausse en zone optimale : progrès");
assert.equal(formDeltaTone(9, -15), "warn", "hausse trop rapide : à surveiller");
assert.equal(formDeltaTone(2, -35), "warn", "hausse en risque élevé : à surveiller");
assert.equal(formDeltaTone(0, 0), "neutral");
assert.equal(formDeltaTone(-2, -15), "neutral", "légère baisse : stable, pas d'alarme");
assert.equal(formDeltaTone(-5, 10), "neutral", "baisse quand tu es frais : le prix de la récupération");
assert.equal(formDeltaTone(-5, 25), "neutral", "baisse en transition : attendue");
assert.equal(formDeltaTone(-5, -15), "warn", "baisse nette sans être frais : à surveiller");
for (const d of [-20, -8, -3, -1, 0, 1, 5, 12]) for (const f of [-40, -15, 0, 10, 30]) assert.notEqual(formDeltaTone(d, f), "bad" as string, "jamais rouge");

console.log("test-fitness : OK");
