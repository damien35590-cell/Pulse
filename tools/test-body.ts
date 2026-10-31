// Lancer avec : npx tsx tools/test-body.ts
// Carte des muscles (lib/workout/body.ts, components/body/body-shapes.ts) : muscles d'un nom, carte de séance, vue, volume, récupération, dessin.
import assert from "node:assert/strict";
import {
  MUSCLE_IDS, MUSCLE_NAME, RUN_CAP, levelStep, muscleList, muscleVolume, musclesOfCode, musclesOfName, preferredView, recoveryLevels, recoveryLine, recoveryStep,
  runLevels, runLoadOf, sessionLevels, shareStep,
} from "../lib/workout/body";
import { BACK_SHAPES, FRONT_SHAPES, STEP_FILL, thumbFrame } from "../components/body/body-shapes";

// ── Muscles d'un exercice ──
assert.deepEqual(musclesOfName("B2 - dips")?.primary, ["chest", "triceps"], "code Lafay avec variante");
assert.deepEqual(musclesOfName("W - mollets")?.primary, ["calves"], "lettre seule");
assert.deepEqual(musclesOfName("Rowing un bras (haltère)")?.primary, ["lats", "upper_back"], "nom SuperPhysique enregistré");
assert.deepEqual(musclesOfCode("A", "A9")?.primary, ["triceps", "chest"], "brouillon : code + variante");
assert.deepEqual(musclesOfName("Squat goblet maison"), { primary: ["quads"], secondary: ["hamstrings"] }, "nom libre : dictionnaire");
assert.equal(musclesOfName("Corde à sauter"), null, "nom inconnu");

// ── Carte d'une séance : principal 1, secondaire 0,5, additionnés et plafonnés ──
const s = sessionLevels([musclesOfName("B - dips"), musclesOfName("J - pompes piquées"), null]);
assert.equal(s.chest, 1, "principal (B) + secondaire (J) : plafonné à 1");
assert.equal(s.front_delts, 1, "secondaire (B) + principal (J)");
assert.equal(s.side_delts, 0.5, "secondaire seul");
assert.equal(s.quads, undefined, "muscle non sollicité absent");
assert.equal(sessionLevels([{ primary: [], secondary: ["abs"] }, { primary: [], secondary: ["abs"] }]).abs, 1, "deux secondaires = un principal");

// ── Vue préférée ──
assert.equal(preferredView({ chest: 1, triceps: 1, front_delts: 0.5 }), "front", "dips : pectoraux devant");
assert.equal(preferredView({ lats: 1, biceps: 1, upper_back: 0.5, forearms: 0.5 }), "back", "tractions : dos");
assert.equal(preferredView({ side_delts: 1, forearms: 1 }), "front", "égalité : la face");
assert.equal(preferredView({ quads: 1, glutes: 1, calves: 0.5, hamstrings: 0.5 }), "back", "squat sauté sans moteur : plus de muscles au dos");
assert.equal(preferredView({ quads: 1, glutes: 1, calves: 0.5, hamstrings: 0.5 }, "quads"), "front", "squat sauté : le moteur (quadriceps) décide");
assert.equal(preferredView({ side_delts: 1, traps: 0.5 }, "side_delts"), "back", "moteur visible des deux côtés : la somme décide");

// ── Volume : séries entières pour un principal, demi-séries pour un secondaire ──
const v = muscleVolume([{ name: "B - dips", sets: 4, reps: 10, loadKg: null }, { name: "Corde à sauter", sets: 3, reps: 50, loadKg: null }], 80);
assert.equal(v.chest.sets, 4);
assert.equal(v.front_delts.sets, 2);
assert.equal(v.chest.tonnage, 4 * 10 * 48, "poids du corps : 60 % de 80 kg");
assert.equal(v.quads.sets, 0, "exercice inconnu ignoré");
assert.equal(Object.keys(v).length, MUSCLE_IDS.length);

// ── Récupération ──
const now = new Date("2026-10-31T18:00:00Z"), ago = (h: number) => new Date(+now - h * 36e5);
const dips = musclesOfName("B - dips");
const r = recoveryLevels([{ at: ago(36), muscles: [dips] }], now);
assert.equal(r.chest, 0.5, "pectoraux : 36 h sur 72");
assert.equal(r.triceps, 0.75, "triceps : 36 h sur 48");
assert.equal(r.front_delts, 0.88, "secondaire : moitié de la charge, 36 h sur 48");
assert.equal(recoveryLevels([{ at: ago(80), muscles: [dips] }], now).chest, undefined, "récupéré : absent");
assert.equal(recoveryLevels([{ at: ago(1), muscles: [dips] }, { at: ago(24), muscles: [dips] }], now).chest, 0, "deux séances rapprochées : plafonné à fatigué");
assert.equal(recoveryLevels([{ at: new Date(+now + 36e5), muscles: [dips] }], now).chest, undefined, "séance future ignorée");
assert.deepEqual([0, 0.3, 0.6, 0.9, 1, undefined].map(recoveryStep), [4, 3, 2, 1, null, null], "fatigué = palier 4");

// ── Course : fatigue des jambes ──
const easy = runLevels({ minutes: 45 }), long = runLevels({ minutes: 100, long: true }), vma = runLevels({ minutes: 50, hard: true });
assert.deepEqual(Object.keys(easy).sort(), ["calves", "glutes", "hamstrings", "quads"], "seulement les jambes");
assert.ok(easy.calves! >= easy.hamstrings! && easy.quads! >= easy.glutes!, "mollets et quadriceps d'abord");
assert.ok(long.quads! > easy.quads! && vma.quads! > easy.quads!, "sortie longue et séance dure pèsent plus qu'un footing");
assert.ok(Object.values(long).every((v) => v! <= RUN_CAP), "plafonnée");
assert.ok(runLevels({ minutes: 600, hard: true }).quads! < 1, "toujours sous une séance de muscu du bas (principal = 1)");
const legs = recoveryLevels([{ at: ago(12), levels: vma }], now);
assert.ok(legs.quads! < 1 && legs.calves! < 1, "les jambes récupèrent après une course");
assert.equal(legs.chest, undefined, "le haut n'est pas touché");
const bas = recoveryLevels([{ at: ago(12), muscles: [musclesOfName("E1 - flexions")] }], now);
assert.ok(bas.quads! < legs.quads!, "une séance de jambes fatigue plus qu'une course");
assert.deepEqual(runLoadOf({ type: "RUN", source: "fit", movingTimeS: 2700, sessionType: "interval" }), { minutes: 45, hard: true, long: false });
assert.equal(runLoadOf({ type: "RUN", source: "fit", movingTimeS: 2700, keySession: true })?.hard, true, "séance clé du programme");
assert.equal(runLoadOf({ type: "RUN", source: "google-fit", movingTimeS: 900 }), null, "Google Fit : déplacement, pas une course");
assert.equal(runLoadOf({ type: "RUN", source: "fit", dedupeKey: "gfit-123", movingTimeS: 900 }), null);
assert.equal(runLoadOf({ type: "WALK", source: "fit", movingTimeS: 1800 }), null, "marche exclue");
assert.equal(runLoadOf({ type: "WORKOUT", source: "manual", movingTimeS: 1800 }), null);

// ── Paliers ──
assert.deepEqual([0, 0.5, 0.6, 0.75, 1].map(levelStep), [null, 1, 2, 3, 4], "séance : secondaire seul = 1, principal = 4");
assert.deepEqual([0, 0.2, 0.25, 0.4, 0.5, 0.6, 0.8, 1].map(shareStep), [null, 1, 1, 2, 2, 3, 4, 4], "part du maximum : quarts");
assert.equal(STEP_FILL[4], "fill-muscle-4");
assert.equal(recoveryLine({}), "Tous tes muscles sont récupérés.");
assert.equal(recoveryLine({ chest: 0.1, triceps: 0.4, calves: 0.9 }), "Encore fatigués : pectoraux et triceps.");
assert.equal(muscleList(["chest", "triceps", "front_delts"]), "Pectoraux, triceps et avant des épaules");

// ── Dessin : chaque muscle a au moins une forme, chaque forme un muscle connu ──
const drawn = new Set([...FRONT_SHAPES, ...BACK_SHAPES].map((x) => x.m).filter(Boolean));
for (const id of MUSCLE_IDS) assert.ok(drawn.has(id), `${id} dessiné`);
for (const id of drawn) assert.ok(MUSCLE_NAME[id!], `${id} : nom français`);
const [, upperY] = thumbFrame({ chest: 1, triceps: 1 }), [, calfY] = thumbFrame({ calves: 1 });
assert.equal(upperY, 58, "haut du corps : cadré de la tête aux hanches");
assert.ok(calfY > 220, "mollets : cadré sur le bas des jambes");
assert.deepEqual(thumbFrame({}), thumbFrame({ chest: 1 }), "rien de sollicité : le haut du corps");
assert.ok(FRONT_SHAPES.some((s) => s.m === "glute_med") && BACK_SHAPES.some((s) => s.m === "glute_med"), "moyen fessier de face et de dos");
assert.ok(thumbFrame({ glute_med: 1 })[1] > 100, "renfo des hanches : vignette sur le bassin");

console.log("test-body : ok");
