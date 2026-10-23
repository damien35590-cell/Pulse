// Lancer avec : npx tsx tools/test-coach-ai.ts
import assert from "node:assert/strict";
import { parseDebrief } from "../lib/coach/ai";
import { DOCTRINE } from "../lib/coach/doctrine";
import { renderCoachText, trimToSentence } from "../lib/coach/chat-render";

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

// Rendu du chat : paragraphes, listes, gras, lignes vides et titres ignorés
const r = renderCoachText("**Oui**, décale-la à jeudi.\n\n- Mardi : footing\n* Jeudi : **VMA**\n2. Samedi : repos\n## Titre");
assert.deepEqual(r.map((b) => b.kind), ["p", "li", "li", "li", "p"]);
assert.deepEqual(r[0].parts, [{ text: "Oui", bold: true }, { text: ", décale-la à jeudi.", bold: false }]);
assert.deepEqual(r[2].parts, [{ text: "Jeudi : ", bold: false }, { text: "VMA", bold: true }]);
assert.equal(r[3].parts[0].text, "Samedi : repos");
assert.equal(r[4].parts[0].text, "Titre");
assert.deepEqual(renderCoachText("a ** b"), [{ kind: "p", parts: [{ text: "a ** b", bold: false }] }]);

// Réponse coupée : retour à la dernière phrase complète
assert.equal(trimToSentence("Repos ce soir. Demain footing facile. Si la gêne dure plus"), "Repos ce soir. Demain footing facile.");
assert.equal(trimToSentence("Phrase complète."), "Phrase complète.");
assert.equal(trimToSentence("Un. Deux trois quatre cinq six sept huit"), "Un. Deux trois quatre cinq six sept huit…");

console.log("coach-ai : OK");
