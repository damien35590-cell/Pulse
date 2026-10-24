// Lancer avec : npx tsx tools/test-zone-ribbon.ts
import assert from "node:assert/strict";
import { parseRibbon, zoneRibbon, RIBBON_BUCKETS, type RibbonSegment } from "../lib/art/zone-ribbon";
import { hasIntervalStructure, shortTitle } from "../lib/art/effort";
import { exerciseCode, setGroups } from "../lib/art/set-bars";
import { cardArt } from "../lib/art/card";

const sum = (r: RibbonSegment[]) => r.reduce((s, x) => s + x.f, 0);
const HR_MAX = 190; // bornes FC : Z1 ≤ 114, Z2 ≤ 133, Z3 ≤ 152, Z4 ≤ 171, Z5 ≤ 181, Z6 au-delà

// Footing régulier : une seule zone, une seule tronçon qui pèse 1.
const flat = zoneRibbon({ hr: new Array(2400).fill(125) }, { hrMax: HR_MAX });
assert.deepEqual(flat, [{ z: 2, f: 1 }], "footing = un tronçon Z2");

// Montée en deux paliers : 40 tranches égales → 20 / 20, fractions qui somment à 1.
const two = zoneRibbon({ hr: [...new Array(1200).fill(125), ...new Array(1200).fill(165)] }, { hrMax: HR_MAX })!;
assert.deepEqual(two.map((s) => s.z), [2, 4]);
assert.ok(Math.abs(two[0].f - 0.5) < 1e-9 && Math.abs(sum(two) - 1) < 1e-9);

// Les tronçons voisins de même zone sont fusionnés ; toutes les fractions sont des multiples de 1/40.
const wavy = zoneRibbon({ hr: Array.from({ length: 4000 }, (_, i) => 120 + 3 * Math.sin(i / 500)) }, { hrMax: HR_MAX })!;
for (let i = 1; i < wavy.length; i++) assert.notEqual(wavy[i].z, wavy[i - 1].z, "pas deux tronçons voisins de même zone");
for (const s of wavy) assert.ok(Math.abs(s.f * RIBBON_BUCKETS - Math.round(s.f * RIBBON_BUCKETS)) < 1e-9);
assert.ok(Math.abs(sum(wavy) - 1) < 1e-9);

// Trous de capteur (0) : ignorés dans la moyenne, comblés par la tranche précédente quand toute la tranche manque.
const gap = zoneRibbon({ hr: [...new Array(1000).fill(125), ...new Array(200).fill(0), ...new Array(1000).fill(125)] }, { hrMax: HR_MAX })!;
assert.deepEqual(gap, [{ z: 2, f: 1 }], "un trou ne crée pas de zone");

// Plus de la moitié sans mesure : pas de ruban.
assert.equal(zoneRibbon({ hr: [...new Array(300).fill(125), ...new Array(2100).fill(0)] }, { hrMax: HR_MAX }), null);
// Sans FC max, trop court, ou sans série : rien.
assert.equal(zoneRibbon({ hr: new Array(2400).fill(125) }, { hrMax: null }), null);
assert.equal(zoneRibbon({ hr: new Array(30).fill(125) }, { hrMax: HR_MAX }), null);
assert.equal(zoneRibbon({}, { hrMax: HR_MAX, ftp: 250 }, { ride: true }), null);

// Vélo : la FC d'abord, la puissance sinon (zéros = roue libre, comptés).
const power = [...new Array(1200).fill(0), ...new Array(1200).fill(260)]; // FTP 250 : Z1 ≤ 137, Z4 ≤ 262
assert.deepEqual(zoneRibbon({ power }, { ftp: 250 }, { ride: true })!.map((s) => s.z), [1, 4]);
assert.equal(zoneRibbon({ power }, { ftp: 250 }), null, "la puissance ne sert que pour le vélo");
assert.deepEqual(zoneRibbon({ hr: new Array(2400).fill(125), power }, { hrMax: HR_MAX, ftp: 250 }, { ride: true }), [{ z: 2, f: 1 }], "FC prioritaire");
assert.deepEqual(zoneRibbon({ hr: [], power }, { hrMax: HR_MAX, ftp: 250 }, { ride: true })!.map((s) => s.z), [1, 4], "FC absente : puissance");

// Relecture du JSON stocké.
assert.deepEqual(parseRibbon(two), two);
assert.equal(parseRibbon(null), null);
assert.equal(parseRibbon([]), null);
assert.equal(parseRibbon([{ z: 7, f: 1 }]), null);
assert.equal(parseRibbon([{ z: 2 }]), null);

// 10 × 400 m : 4+ blocs durs séparés de facile → structure ; un footing ou un tempo continu → non.
const reps: RibbonSegment[] = [{ z: 2, f: 0.2 }];
for (let i = 0; i < 5; i++) reps.push({ z: 5, f: 0.05 }, { z: 2, f: 0.075 });
reps.push({ z: 1, f: 0.025 });
assert.ok(hasIntervalStructure(reps));
assert.ok(!hasIntervalStructure(flat!));
assert.ok(!hasIntervalStructure([{ z: 2, f: 0.2 }, { z: 4, f: 0.6 }, { z: 2, f: 0.2 }]), "tempo continu");
assert.ok(!hasIntervalStructure([{ z: 2, f: 0.3 }, { z: 4, f: 0.1 }, { z: 2, f: 0.3 }, { z: 4, f: 0.1 }, { z: 2, f: 0.2 }]), "2 blocs seulement");
assert.ok(hasIntervalStructure([{ z: 2, f: 0.2 }, { z: 4, f: 0.05 }, { z: 5, f: 0.05 }, { z: 2, f: 0.1 }, { z: 4, f: 0.1 }, { z: 2, f: 0.1 }, { z: 5, f: 0.1 }, { z: 2, f: 0.1 }, { z: 4, f: 0.1 }, { z: 2, f: 0.1 }]), "Z4→Z5 voisins = un seul bloc");

// Étiquettes des séances clés.
assert.equal(shortTitle("VMA courte · 10 × 400 m"), "10×400");
assert.equal(shortTitle("VMA courte · 10 × 30/30"), "10×30/30");
assert.equal(shortTitle("Seuil · 3 × 10′"), "3×10′");
assert.equal(shortTitle("Seuil · 3 x 8 min"), "3×8′");
assert.equal(shortTitle("Test VMA (demi-Cooper)"), "Test VMA");
assert.equal(shortTitle("Une très longue séance sans répétitions"), undefined);

// SetBars : une barre par série faite, échauffement exclu, 4 groupes au plus, ordre de la séance.
assert.equal(exerciseCode("B2 - dips"), "B2");
assert.equal(exerciseCode("F - squat sauté"), "F");
assert.equal(exerciseCode("Développé couché"), "DC");
const lift = setGroups([
  { name: "B2 - dips", sets: 6, reps: 9, setsDetail: [{ reps: 5, done: true, isWarmup: true }, { reps: 9, done: true }, { reps: 9, done: true }, { reps: 8, done: true }, { reps: 7, done: false }, { reps: 9, done: true }] },
  { name: "A3 - pompes", sets: 3, reps: 12 }, // sans détail : le prévu est supposé fait
  { name: "C - tractions", sets: 4, reps: 0, setsDetail: [{ reps: 6, done: true }, { reps: 4, done: true }] }, // cible absente → max de l'exercice
  { name: "G - crunch", sets: 2, reps: 15, setsDetail: [{ reps: 15, done: true }, { reps: 20, done: true }] },
  { name: "H - relevés de genoux", sets: 2, reps: 10 },
]);
assert.equal(lift.length, 4, "4 groupes au plus");
assert.deepEqual(lift[0].sets, [9, 9, 8, 9], "échauffement et séries non faites exclus");
assert.equal(lift[0].target, 9);
assert.deepEqual(lift[1].sets, [12, 12, 12]);
assert.equal(lift[2].target, 6, "repli : max de l'exercice");
assert.deepEqual(lift.map((g) => g.code), ["B2", "A3", "C", "G"]);
assert.ok(lift.every((g) => g.max === 20), "échelle commune sur la séance (reps)");

// Exercice au chrono (E4, mode time) : barre = secondes, échelle séparée des répétitions.
const timed = setGroups([
  { name: "A3 - pompes", sets: 2, reps: 12 },
  { name: "E4 - flexions latérales", sets: 2, reps: 45, setsDetail: [{ reps: 40, done: true }, { reps: 45, done: true }] },
]);
assert.deepEqual(timed.map((g) => g.timed), [false, true]);
assert.deepEqual(timed.map((g) => g.max), [12, 45], "reps et secondes ne s'écrasent pas");
assert.equal(timed[1].target, 45);

// Choix de l'art par carte.
const ribbon = two;
const run = { type: "RUN", hasRoute: true, zoneRibbon: ribbon };
assert.deepEqual(cardArt(run), { ribbon });
assert.deepEqual(cardArt({ ...run, hasRoute: false }), {}, "course sans carte ni séance clé : inchangée");
assert.deepEqual(cardArt({ type: "RUN", hasRoute: true }), {}, "pas de ruban : inchangée");
assert.deepEqual(cardArt({ ...run, plannedSession: { kind: "INTERVALS_SHORT", title: "VMA courte · 8 × 400 m" } }), { effort: { segments: ribbon, label: "8×400" } });
assert.deepEqual(cardArt({ ...run, plannedSession: { kind: "THRESHOLD", title: "Seuil · 3 × 10′" }, hasRoute: false }), { effort: { segments: ribbon, label: "3×10′" } });
assert.deepEqual(cardArt({ ...run, plannedSession: { kind: "LONG_RUN", title: "Sortie longue · 90′" } }), { ribbon }, "séance non clé : ruban");
assert.deepEqual(cardArt({ type: "RUN", hasRoute: true, zoneRibbon: reps }), { effort: { segments: reps } }, "intervalles nets sans séance liée : pas d'étiquette");
assert.deepEqual(cardArt({ type: "RIDE", hasRoute: false, source: "mywhoosh", zoneRibbon: ribbon }), { ribbon }, "MyWhoosh : ruban seul");
assert.deepEqual(cardArt({ type: "RIDE", hasRoute: false, source: "fit", zoneRibbon: ribbon }), {}, "autre vélo sans GPS : inchangé");
assert.deepEqual(cardArt({ type: "HIKE", hasRoute: true, zoneRibbon: ribbon }), { ribbon });
assert.deepEqual(cardArt({ type: "WALK", hasRoute: true, zoneRibbon: ribbon }), {});
assert.deepEqual(cardArt({ type: "WORKOUT", hasRoute: false, exercises: [] }), {}, "muscu sans exercices : inchangée");
assert.equal(cardArt({ type: "WORKOUT", hasRoute: false, exercises: [{ name: "A3 - pompes", sets: 3, reps: 10 }] }).sets?.length, 1);
console.log("art du fil : ok");
