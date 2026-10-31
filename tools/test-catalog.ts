// Lancer avec : npx tsx tools/test-catalog.ts
// Catalogue d'exercices (lib/workout/catalog-data.ts) : cohérence des données, échelles, clés d'historique, bibliothèque de modèles.
import assert from "node:assert/strict";
import { ALL_EXERCISES, FAMILIES, PROGRAM_TEMPLATES } from "../lib/workout/catalog-data";
import {
  catalogExercise, catalogFor, displayLabel, doable, equipmentOf, isLafayCode, isVariantCode, ladderKey, missingEquipment, nextInLadder, prevInLadder, resolveName,
} from "../lib/workout/catalog";
import { groupKey, nextVariant, variantOf } from "../lib/analytics/strength";
import { lafayCode, musclesOf } from "../lib/muscles";
import { prescription, sessionNames, structureOf, templateStructures } from "../lib/workout/library";
import { MUSCLE_IDS } from "../lib/workout/body";

// ── Données ──
const ids = ALL_EXERCISES.map((e) => e.id);
assert.equal(new Set(ids).size, ids.length, "ids uniques");
const inGroups = new Set(FAMILIES.flatMap((f) => f.groups.flatMap((g) => g.progression)));
for (const e of ALL_EXERCISES) assert.ok(inGroups.has(e.id), `${e.id} rangé dans une sous-catégorie`);
for (const id of inGroups) assert.ok(catalogExercise(id), `${id} existe`);
for (const t of PROGRAM_TEMPLATES) for (const s of t.sessions) for (const x of s.exercises) for (const id of [x.exerciseId, ...(x.alternatives ?? [])]) assert.ok(catalogExercise(id), `${t.id} → ${id}`);
assert.equal(ALL_EXERCISES.filter((e) => e.source === "lafay").length, 77);
for (const e of ALL_EXERCISES.filter((x) => x.source === "lafay")) assert.ok(isLafayCode(e.family), `${e.id} : lettre connue`);

// ── Muscles (carte du corps) ──
const KNOWN = new Set<string>(MUSCLE_IDS);
for (const e of ALL_EXERCISES) {
  assert.ok(e.muscles.primary.length > 0, `${e.id} : au moins un muscle principal`);
  for (const m of [...e.muscles.primary, ...e.muscles.secondary]) assert.ok(KNOWN.has(m), `${e.id} : muscle ${m} inconnu`);
  assert.ok(!e.muscles.secondary.some((m) => e.muscles.primary.includes(m)), `${e.id} : un muscle est principal ou secondaire, pas les deux`);
}
assert.deepEqual(catalogExercise("B")!.muscles, { primary: ["chest", "triceps"], secondary: ["front_delts"] }, "dips");
assert.deepEqual(catalogExercise("C")!.muscles, { primary: ["lats", "biceps"], secondary: ["upper_back", "forearms"] }, "tractions supination");
assert.deepEqual(catalogExercise("F")!.muscles, { primary: ["quads", "glutes"], secondary: ["calves", "hamstrings"] }, "squat sauté");
assert.deepEqual(catalogExercise("J")!.muscles.primary, ["front_delts", "triceps"], "pompes piquées");
assert.deepEqual(catalogExercise("C2")!.muscles, catalogExercise("C")!.muscles, "une variante hérite de sa famille");
assert.equal(catalogExercise("A9")!.muscles.primary[0], "triceps", "pompes très serrées : surtout les triceps");

// ── Codes saisis ──
assert.deepEqual(lafayCode("K2 - triceps"), { letter: "k", digits: 2 });
assert.deepEqual(lafayCode("W - mollets"), { letter: "w", digits: null });
assert.equal(lafayCode("L-sit"), null, "« L-sit » n'est pas l'exercice L");
assert.equal(lafayCode("T-bar row"), null);
assert.equal(lafayCode("V-ups"), null);
assert.equal(lafayCode("Oiseau (haltères)"), null);
assert.deepEqual(resolveName("A3 - pompes"), { code: "A", variant: "A3", name: "A3 - pompes" });
assert.deepEqual(resolveName("J1"), { code: "J", variant: "J1", name: "J1 - pompes piquées" });
assert.deepEqual(resolveName("G - crunch"), { code: "G", variant: null, name: "G - crunch" });
assert.ok(musclesOf("K2 - triceps").some(([g]) => g === "triceps"));

// ── Échelles ──
assert.equal(nextInLadder("A3"), "A4");
assert.equal(nextInLadder("A2"), null, "A2 termine les pompes larges");
assert.equal(prevInLadder("B"), "B2");
assert.equal(nextInLadder("A10"), null, "pompes circulaires : pas d'ordre");
assert.equal(nextVariant("C3"), "C");
assert.equal(variantOf("G - crunch"), null);
assert.equal(variantOf("F1 - squat sauté"), "F1");
assert.ok(isVariantCode("F1") && !isVariantCode("F"));

// ── Clés d'historique : A2 et A3 sont deux exercices, B1 et B le même ──
assert.equal(ladderKey("B1"), "lafay:b");
assert.equal(ladderKey("B"), ladderKey("B2"));
assert.equal(ladderKey("A2"), "lafay:a");
assert.equal(ladderKey("A3"), "lafay:a#1");
assert.equal(groupKey("A3 - pompes"), "lafay:a#1");
assert.equal(groupKey("B2 - dips"), "lafay:b");
assert.equal(groupKey("C4 - tractions"), "lafay:c#1");

// ── Fiches ──
assert.equal(catalogFor("A", "A3")?.subtitle, "Mains sur support de 45 cm");
assert.equal(catalogFor("F", null)?.name, "Squat sauté");
const row1 = catalogExercise("rowing-un-bras-haltere")!;
assert.equal(displayLabel(row1), "Rowing un bras (haltère)");
assert.equal(catalogFor(displayLabel(row1), null)?.id, row1.id, "aller-retour nom ↔ fiche");
assert.equal(lafayCode(displayLabel(row1)), null);
for (const e of ALL_EXERCISES.filter((x) => x.source !== "lafay")) assert.equal(lafayCode(displayLabel(e)), null, `${displayLabel(e)} ne doit pas passer pour un code Lafay`);

// ── Mon matériel ──
const mine = equipmentOf([]);
assert.ok(mine.includes("aucun") && mine.includes("barres-dips") && !mine.includes("halteres"), "défaut : chaise romaine + maison");
assert.ok(equipmentOf(["halteres"]).includes("aucun"));
assert.ok(doable(catalogExercise("B")!, mine));
assert.ok(!doable(row1, mine));
assert.ok(doable(row1, equipmentOf([...mine, "halteres"])));
assert.deepEqual(missingEquipment(["halteres"], mine), ["halteres"]);

// ── Bibliothèque → modèles de séance ──
const n2 = PROGRAM_TEMPLATES.find((t) => t.id === "lafay-n2")!;
const [s2] = templateStructures(n2);
assert.equal(s2.name, "Lafay · Niveau 2");
assert.deepEqual(s2.structure.slice(0, 3).map((s) => [s.code, s.variant]), [["B", "B1"], ["A", "A3"], ["A", "A2"]], "A3 et A2 dans la même séance");
assert.deepEqual([s2.structure[0].sets, s2.structure[0].reps, s2.structure[0].restSec, s2.structure[0].restAfterSec], [6, 5, 25, 25]);
const f = s2.structure.find((s) => s.code === "F")!;
assert.equal(f.variant, null);
const k2 = s2.structure.find((s) => s.variant === "K2")!;
assert.equal(k2.note, "Maximum de répétitions");
const hybrid = PROGRAM_TEMPLATES.find((t) => t.id === "perso-hybride-ab")!;
assert.deepEqual(sessionNames(hybrid), ["Hybride Lafay + SuperPhysique (A/B) · A · Haut", "Hybride Lafay + SuperPhysique (A/B) · B · Bas + abdos"].map((n) => n.slice(0, 60)));
const rowing = structureOf(hybrid.sessions[0].exercises[3]);
assert.deepEqual([rowing.code, rowing.variant, rowing.reps], ["Rowing un bras (haltère)", null, 8]);
assert.match(rowing.note ?? "", /Fourchette 8–12/);
assert.equal(prescription(hybrid.sessions[0].exercises[3]), "3 × 8–12");
assert.equal(prescription({ exerciseId: "gainage", sets: 3, reps: null, restSec: 45 }), "3 × max");
assert.equal(prescription({ exerciseId: "F1", sets: 3, reps: 60, restSec: 60 }), "3 × 60 s");
for (const t of PROGRAM_TEMPLATES) for (const n of sessionNames(t)) assert.ok(n.length <= 60, `${n} : 60 caractères max`);

console.log("catalog : OK");
