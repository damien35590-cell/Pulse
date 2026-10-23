// Lancer avec : npx tsx tools/test-coach-ai.ts
import assert from "node:assert/strict";
import { parseDebrief } from "../lib/coach/ai";
import { DOCTRINE } from "../lib/coach/doctrine";

const ok = { verdict: "Bonne période.", points: [{ tone: "good", text: "Les dips progressent." }, { tone: "bizarre", text: "Peu de course." }, { tone: "bad", text: "" }], consigne: "2 sorties faciles de 40 min.", principe: "Campus Coach : régularité avant intensité." };

// JSON propre, entouré de texte ou de balises de code
let d = parseDebrief(JSON.stringify(ok))!;
assert.equal(d.verdict, "Bonne période.");
assert.equal(d.points.length, 2, "les points vides sont ignorés");
assert.equal(d.points[1].tone, "warn", "ton inconnu → vigilance");
assert.equal(d.principe, "Campus Coach : régularité avant intensité.");
assert.ok(parseDebrief("Voici :\n```json\n" + JSON.stringify(ok) + "\n```"));
assert.equal(parseDebrief(JSON.stringify({ ...ok, principe: null }))!.principe, null);
assert.equal(parseDebrief(JSON.stringify({ ...ok, principe: "null" }))!.principe, null);

// Au plus 4 points ; verdict et consigne obligatoires
assert.equal(parseDebrief(JSON.stringify({ ...ok, points: Array.from({ length: 7 }, () => ({ tone: "good", text: "x" })) }))!.points.length, 4);
assert.equal(parseDebrief(JSON.stringify({ ...ok, consigne: "" })), null);
assert.equal(parseDebrief("pas de json"), null);
assert.equal(parseDebrief("{ cassé"), null);

// La doctrine couvre les trois méthodes et les règles clés
for (const k of ["Lafay", "SuperPhysique", "Campus Coach", "TOTAL de répétitions", "VMA", "vélotaf"]) assert.ok(DOCTRINE.includes(k), k);

console.log("coach-ai : OK");
