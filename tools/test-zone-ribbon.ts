// Lancer avec : npx tsx tools/test-zone-ribbon.ts
import assert from "node:assert/strict";
import { parseRibbon, refsChange, zoneRibbon as ribbonOf, RIBBON_BUCKETS, type RibbonOpts, type RibbonRefs, type RibbonSegment, type RibbonStream } from "../lib/art/zone-ribbon";
import { readFileSync } from "node:fs";
import { detectIntervals } from "../lib/art/interval";
import { paceUpper } from "../lib/art/zone-ribbon";
import { paceSeries, type PacePoint } from "../lib/art/pace";
import { hasIntervalStructure, hasPaceIntervalStructure, shortTitle } from "../lib/art/effort";
import { exerciseCode, setGroups } from "../lib/art/set-bars";
import { cardArt } from "../lib/art/card";

/** Segments seuls ; la source et le seuil sont vérifiés plus bas avec ribbonOf. */
const zoneRibbon = (st: RibbonStream, refs: RibbonRefs, opts: RibbonOpts = {}) => ribbonOf(st, refs, opts)?.segments ?? null;
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

// Source et seuil mémorisés avec le ruban.
const hrRibbon = ribbonOf({ hr: new Array(2400).fill(125) }, { hrMax: HR_MAX, ftp: 250 }, { ride: true })!;
assert.deepEqual([hrRibbon.source, hrRibbon.ref], ["hr", HR_MAX]);
const pwRibbon = ribbonOf({ power }, { hrMax: HR_MAX, ftp: 250 }, { ride: true })!;
assert.deepEqual([pwRibbon.source, pwRibbon.ref], ["power", 250]);

// ─── Allure (course sans FC) : zones en % de la VMA, trace GPS d'un point toutes les 3 s ───
const VMA = 15; // Z1 ≤ 9, Z2 ≤ 11,25, Z3 ≤ 12,75, Z4 ≤ 13,8, Z5 ≤ 15, Z6 au-delà
const M_PER_DEG = 111195; // 1° de latitude, en mètres (rayon 6 371 km)
/** Trace vers le nord : plan = [secondes, km/h] ; 0 km/h = à l'arrêt (le GPS reste en place). `step` : secondes entre deux points. */
function track(plan: [number, number][], step = 3): PacePoint[] {
  const pts: PacePoint[] = [{ t: 0, lat: 48, lng: -1.6 }];
  let t = 0, lat = 48;
  for (const [sec, kmh] of plan) {
    for (let k = 0; k < sec; k += step) { t += step; lat += (kmh / 3.6 * step) / M_PER_DEG; pts.push({ t: t * 1000, lat, lng: -1.6 }); }
  }
  return pts;
}
const paceOf = (plan: [number, number][], vma: number | null = VMA, step = 3) => ribbonOf({ points: track(plan, step) }, { vma }, { run: true });

const steady = paceSeries(track([[1200, 12]]));
assert.ok(steady.length >= 1199 && steady.length <= 1201, "une valeur par seconde");
assert.ok(steady.slice(50, -50).every((v) => Math.abs(v - 12) < 0.05), "vitesse constante lue juste (12 km/h)");

const easy = paceOf([[2400, 12]])!; // 80 % de la VMA
assert.deepEqual(easy.segments, [{ z: 3, f: 1 }]);
assert.deepEqual([easy.source, easy.ref], ["pace", VMA]);
for (const [kmh, z] of [[8.5, 1], [9.5, 2], [12, 3], [13.5, 4], [14.5, 5], [16, 6]] as const) assert.deepEqual(paceOf([[1800, kmh]])!.segments, [{ z, f: 1 }], `${kmh} km/h = Z${z}`);
assert.equal(paceOf([[2400, 12]], null), null, "sans VMA : pas de ruban d'allure");
assert.equal(ribbonOf({ points: track([[2400, 12]]) }, { vma: VMA }), null, "l'allure ne sert que pour la course");
assert.equal(ribbonOf({ points: track([[2400, 12]]) }, { vma: VMA }, { ride: true }), null, "ni pour le vélo");
assert.equal(paceOf([[30, 12]]), null, "trop court");

// Arrêts (< 1 km/h) ignorés : ni Z1 ni moyenne tirée vers le bas ; trop d'arrêts : pas de ruban.
assert.deepEqual(paceOf([[1200, 12], [300, 0], [1200, 12]])!.segments, [{ z: 3, f: 1 }], "un arrêt de 5 min ne crée pas de Z1");
assert.equal(paceOf([[600, 12], [1800, 0]]), null, "75 % d'arrêt : pas de ruban");
// Saut GPS (500 m en 3 s) ignoré.
const glitchy = track([[1200, 12]]);
glitchy[200] = { ...glitchy[200], lat: glitchy[200].lat! + 500 / M_PER_DEG };
assert.deepEqual(ribbonOf({ points: glitchy }, { vma: VMA }, { run: true })!.segments, [{ z: 3, f: 1 }], "un saut GPS ne change pas la zone");
// Pause de montre : un trou de 5 min dans la trace n'est pas une allure de marche.
const before = track([[900, 12]]), resumeAt = before.at(-1)!.lat! + 300 / M_PER_DEG - 48; // 300 m parcourus pendant les 5 min de pause (3,6 km/h)
const paused = [...before, ...track([[900, 12]]).map((p) => ({ ...p, t: p.t + 1200e3, lat: p.lat! + resumeAt }))];
assert.deepEqual(ribbonOf({ points: paused }, { vma: VMA }, { run: true })!.segments, [{ z: 3, f: 1 }], "pause de montre ignorée");
// Trace compactée d'une longue sortie (un point toutes les 8 s).
assert.deepEqual(paceOf([[7200, 12]], VMA, 8)!.segments, [{ z: 3, f: 1 }]);

// Priorité des sources : FC > puissance > allure.
const hrSeries = new Array(2400).fill(125), run12 = track([[2400, 12]]);
assert.equal(ribbonOf({ hr: hrSeries, points: run12 }, { hrMax: HR_MAX, vma: VMA }, { run: true })!.source, "hr", "FC prioritaire sur l'allure");
assert.equal(ribbonOf({ hr: hrSeries, points: run12 }, { vma: VMA }, { run: true })!.source, "pace", "FC sans FC max : allure");
assert.equal(ribbonOf({ hr: [...new Array(300).fill(125), ...new Array(2100).fill(0)], points: run12 }, { hrMax: HR_MAX, vma: VMA }, { run: true })!.source, "pace", "FC trop lacunaire : allure");
assert.equal(ribbonOf({ power, points: run12 }, { ftp: 250, vma: VMA }, { ride: true, run: true })!.source, "power", "puissance prioritaire sur l'allure");

// Fractionné 10 × 90 s à la VMA (récup 90 s à 8 km/h) : reconnu comme séance d'intervalles, comme avec la FC.
const paceRepsPlan: [number, number][] = [[900, 10]];
for (let i = 0; i < 10; i++) paceRepsPlan.push([90, 15], [90, 8]);
paceRepsPlan.push([600, 9]);
const paceReps = paceOf(paceRepsPlan)!;
assert.ok(hasIntervalStructure(paceReps.segments), "10 × 90 s détecté sur l'allure");
assert.ok(!hasIntervalStructure(easy.segments), "un footing régulier non");
assert.deepEqual(cardArt({ type: "RUN", hasRoute: true, zoneRibbon: paceReps.segments }), { effort: { segments: paceReps.segments } }, "séance d'intervalles à l'allure : EffortStrip");

// Règle d'allure plus stricte : blocs durs d'au moins 2 tranches, récupération Z1–Z2 entre eux, 15 % du temps en Z4+ au moins.
const B = 1 / 40, seg = (...a: [number, number][]): RibbonSegment[] => a.map(([z, n]) => ({ z: z as RibbonSegment["z"], f: n * B }));
const many = (n: number, hard: [number, number], rec: [number, number]) => Array.from({ length: n }, () => [hard, rec]).flat() as [number, number][];
assert.ok(hasPaceIntervalStructure(seg([2, 6], ...many(5, [5, 2], [2, 2]), [2, 4])), "5 blocs de 2 tranches, 25 % en dur");
assert.ok(!hasPaceIntervalStructure(seg([2, 10], ...many(5, [5, 1], [2, 5]), [2, 5])), "blocs d'une tranche = bruit");
assert.ok(!hasPaceIntervalStructure(seg([2, 6], ...many(3, [5, 2], [2, 4]), [2, 4])), "3 blocs seulement");
assert.ok(!hasPaceIntervalStructure(seg([3, 4], ...many(5, [4, 2], [3, 3]), [3, 4])), "séparés par du Z3 seulement : un seul bloc");
assert.ok(hasPaceIntervalStructure(seg([2, 14], ...many(4, [4, 2], [2, 4]), [2, 2])), "4 blocs de 2 tranches = 20 % du temps : détecté");
// Le ruban FC garde l'ancienne règle.
assert.ok(hasIntervalStructure(seg([2, 10], ...many(5, [5, 1], [2, 5]), [2, 5])), "FC : un bloc d'une tranche compte");

// Détection à 10 s sur des sorties réelles (tranches de 10 s de la base de dev, VMA 15) : fractionnés connus vs sorties faciles d'octobre 2026.
const fx = JSON.parse(readFileSync(new URL("./fixtures/intervals-dev.json", import.meta.url), "utf8")) as { vma: number; runs: { date: string; km: number; expect: boolean; slots: number[] }[] };
for (const r of fx.runs) {
  const d = detectIntervals(r.slots, paceUpper(fx.vma));
  assert.equal(d.is, r.expect, `${r.date} ${r.km} km : ${r.expect ? "fractionné" : "sortie facile"} attendu (répétitions détectées : ${d.reps})`);
}
// Synthétique : 10 × 90 s à la VMA / 90 s trot détecté ; 3 répétitions non ; un tempo continu non.
const slotsOf = (plan: [number, number][]) => plan.flatMap(([sec, v]) => new Array<number>(sec / 10).fill(v));
const ten = slotsOf([[900, 10], ...Array.from({ length: 10 }, () => [[90, 15], [90, 8]] as [number, number][]).flat(), [600, 9]]);
assert.deepEqual(detectIntervals(ten, paceUpper(15)), { is: true, reps: 10 });
assert.equal(detectIntervals(slotsOf([[900, 10], ...Array.from({ length: 3 }, () => [[90, 15], [90, 8]] as [number, number][]).flat(), [600, 9]]), paceUpper(15)).is, false);
assert.equal(detectIntervals(slotsOf([[600, 10], [1500, 14], [600, 9]]), paceUpper(15)).is, false, "tempo continu");

// Seuils qui bougent : FC max ≥ 2 bpm, FTP ≥ 2 W, VMA au dixième ; un seuil qui apparaît ou disparaît compte toujours.
assert.deepEqual(refsChange({ hrMax: 185 }, { hrMax: 186 }), { stale: [], appeared: false });
assert.deepEqual(refsChange({ hrMax: 185 }, { hrMax: 187 }), { stale: ["hr"], appeared: false });
assert.deepEqual(refsChange({ hrMax: 185, ftp: 250, vma: 15 }, { hrMax: 185, ftp: 251, vma: 15 }), { stale: [], appeared: false });
assert.deepEqual(refsChange({ ftp: 250 }, { ftp: 252 }), { stale: ["power"], appeared: false });
assert.deepEqual(refsChange({ vma: 15 }, { vma: 15.1 }), { stale: ["pace"], appeared: false });
assert.deepEqual(refsChange({ hrMax: null }, { hrMax: 190 }), { stale: ["hr"], appeared: true });
assert.deepEqual(refsChange({ vma: 15 }, { vma: null }), { stale: ["pace"], appeared: false });
assert.deepEqual(refsChange({}, { hrMax: null }), { stale: [], appeared: false });

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
