// Allure ajustée au dénivelé (lib/run/gap.ts). Lancer avec : npx tsx tools/test-gap.ts
import assert from "node:assert/strict";
import { GAP_MIN_GAIN_M, gapIfHilly, gapPace, gapRatio, gradeFactor, minettiCost, smoothElevation, type GapPoint } from "../lib/run/gap";

const M_PER_DEG = 111_194.93;
/** Ligne droite vers le nord, un point tous les 10 m, à `paceSKm` ; pente en fraction selon la distance ; bruit d'altitude ±noise en alternance. */
const run = (meters: number, grade: (m: number) => number, paceSKm = 300, noise = 0): GapPoint[] => {
  const pts: GapPoint[] = [];
  let t = 0, ele = 100;
  for (let m = 0; m <= meters; m += 10) {
    if (m) { t += paceSKm * 10; ele += grade(m) * 10; }
    const jitter = noise ? ((m / 10) % 2 ? noise : -noise) : 0;
    pts.push({ lat: 48 + m / M_PER_DEG, lng: -1.68, ele: ele + jitter, t });
  }
  return pts;
};
const near = (a: number, b: number, tol: number, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≉ ${b} (±${tol})`);

// Courbe de Minetti : 3,6 à plat, ~1,7× à +10 %, descente douce moins coûteuse, remontée du coût en descente très raide
near(minettiCost(0), 3.6, 1e-9);
near(gradeFactor(0), 1, 1e-9);
assert.ok(gradeFactor(0.1) > 1.5 && gradeFactor(0.1) < 2, `+10 % : ${gradeFactor(0.1)}`);
assert.ok(gradeFactor(-0.05) < 1, "descente douce moins coûteuse");
assert.ok(gradeFactor(-0.3) > gradeFactor(-0.15), "descente très raide : le coût remonte");
assert.equal(gradeFactor(0.8), gradeFactor(0.3), "pente bornée à +30 %");
assert.equal(gradeFactor(-0.8), gradeFactor(-0.3), "pente bornée à −30 %");

// Plat : même allure
const flat = run(3000, () => 0);
near(gapRatio(flat)!, 1, 1e-9, "ratio à plat");
near(gapPace(flat, 3000, 900)!, 300, 0.01, "plat");
near(gapRatio(run(3000, () => 0, 300, 3))!, 1, 0.03, "plat bruité, altitude lissée");

// Montée constante à 5 % : GAP plus rapide que l'allure brute
const up = run(2000, () => 0.05);
const gUp = gapPace(up, 2000, 600)!;
assert.ok(gUp < 300, `montée : ${gUp}`);
near(gUp, 300 / gradeFactor(0.05), 3, "montée 5 % (bords de trace lissés)");
// Descente constante à 5 % : GAP plus lent que l'allure brute
const down = run(2000, () => -0.05);
const gDown = gapPace(down, 2000, 600)!;
assert.ok(gDown > 300, `descente : ${gDown}`);
near(gDown, 300 / gradeFactor(-0.05), 3, "descente 5 % (bords de trace lissés)");

// Même côte montée puis descendue à allure brute constante : la descente (6 %, ~0,73× le coût du plat) est faite à un effort bas, le GAP est donc plus lent que le brut
const loop = run(4000, (m) => (m <= 2000 ? 0.06 : -0.06));
const gLoop = gapPace(loop, 4000, 1200)!;
assert.ok(gLoop > 300 && gLoop < 340, `boucle : ${gLoop}`);

// Pente aberrante (mur de 80 % sur 20 m) : bornée, pas d'explosion
const wall = run(1000, (m) => (m > 500 && m <= 520 ? 0.8 : 0));
const gWall = gapPace(wall, 1000, 300)!;
assert.ok(gWall > 250 && gWall < 300, `mur : ${gWall}`);

// Arrêt long sans déplacement : ne pèse pas
const paused = [...flat.slice(0, 100), ...flat.slice(100).map((p) => ({ ...p, t: p.t + 600_000 }))];
near(gapRatio(paused)!, 1, 1e-9, "pause");

// Lissage : un pic isolé est écrasé
const cum = Array.from({ length: 21 }, (_, i) => i * 10);
const spike = cum.map(() => 100);
spike[10] = 130;
const sm = smoothElevation(cum, spike);
assert.ok(sm[10] < 120 && sm[10] > 100, `pic lissé : ${sm[10]}`);

// Données insuffisantes
assert.equal(gapRatio([]), null);
assert.equal(gapRatio(run(100, () => 0)), null, "trace trop courte");
assert.equal(gapRatio(flat.map(({ ele, ...p }) => p)), null, "sans altitude");
assert.equal(gapRatio(flat.map(({ lat, lng, ...p }) => p)), null, "sans GPS");
assert.equal(gapPace(flat, 100, 30), null, "distance trop courte");

// Seuil de D+
const meta = (g: number) => ({ distanceM: 2000, movingTimeS: 600, elevationGainM: g });
assert.equal(gapIfHilly(up, meta(GAP_MIN_GAIN_M - 1)), null);
assert.ok(gapIfHilly(up, meta(GAP_MIN_GAIN_M))! < 300);

console.log("gap : ok");
