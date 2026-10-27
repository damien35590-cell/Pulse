// Lancer avec : npx tsx tools/test-heart-rate.ts
import assert from "node:assert/strict";
import { parseHeartRate } from "../lib/ble/heart-rate";
import { annotateSets, cleanHrSeries, hrStats, restDrop, setsOf, toSecondSeries, type HrSample, type HrSet } from "../lib/workout/hr";
import { toPayload } from "../lib/workout/lift";
import type { LiftExercise } from "../components/workout/set-logger";

// ── Trame du service Heart Rate (0x2A37) ──
const dv = (...bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);
assert.equal(parseHeartRate(dv(0x00, 142)), 142, "drapeau bit 0 = 0 : FC sur 8 bits");
assert.equal(parseHeartRate(dv(0x01, 180, 0x00)), 180, "bit 0 = 1 : FC sur 16 bits petit-boutiste");
assert.equal(parseHeartRate(dv(0x01, 0x2c, 0x01)), null, "300 bpm : hors plage");
assert.equal(parseHeartRate(dv(0x10, 95, 0x40, 0x03)), 95, "intervalles RR (bit 4) ignorés");
assert.equal(parseHeartRate(dv(0x16, 64, 0x00, 0x00)), 64, "contact + énergie + RR : la FC reste lue au même endroit");
assert.equal(parseHeartRate(dv(0x00, 0)), null, "0 = pas de contact avec la peau");
assert.equal(parseHeartRate(dv(0x00)), null, "trame trop courte");
assert.equal(parseHeartRate(dv(0x01, 120)), null, "16 bits annoncés mais un seul octet");

// ── Nettoyage de la série reçue ──
assert.deepEqual(cleanHrSeries("x"), []);
assert.deepEqual(cleanHrSeries(null), []);
assert.deepEqual(
  cleanHrSeries([{ t: 5, bpm: 120 }, { t: 2, bpm: 110 }, { t: 5, bpm: 199 }, { t: -1, bpm: 100 }, { t: 3, bpm: 0 }, { t: 4, bpm: 400 }, { t: 6.4, bpm: 121.6 }, { t: "x", bpm: 100 }, null, { t: 90000, bpm: 100 }]),
  [{ t: 2, bpm: 110 }, { t: 5, bpm: 120 }, { t: 6, bpm: 122 }],
  "trié, un échantillon par seconde (le premier), hors plage écarté, arrondi",
);

// ── Moyenne et max ──
const flat = (n: number, bpm: number): HrSample[] => Array.from({ length: n }, (_, t) => ({ t, bpm }));
assert.equal(hrStats(flat(29, 100)), null, "moins de 30 échantillons : pas de séance avec FC");
assert.deepEqual(hrStats([...flat(29, 100), { t: 29, bpm: 130 }]), { avg: 101, max: 130 });

// ── Pic et fin de repos de chaque série ──
const T0 = Date.parse("2026-10-27T18:00:00Z"), at = (s: number) => new Date(T0 + s * 1000).toISOString();
const series: HrSample[] = [];
for (let t = 0; t <= 300; t++) series.push({ t, bpm: 110 });
const put = (from: number, to: number, bpm: number) => { for (let t = from; t <= to; t++) series[t].bpm = bpm; };
put(95, 105, 150); put(102, 102, 156);   // série 1 validée à 100 s : pic 156 (2 s après)
put(126, 130, 118);                      // fin du repos 1 (100 + 30 s) : 118
put(158, 170, 140); put(165, 165, 160);  // série 2 validée à 160 s : pic 160 à 165 s
put(176, 180, 125);                      // fin du repos 2 (160 + 20 s) : 125
put(241, 250, 150);                      // série 3 validée à 240 s : pic dans les 10 s qui suivent
const ex: { setsDetail: HrSet[] }[] = [
  { setsDetail: [{ completedAt: at(100), restTakenS: 30 }, { completedAt: at(240) }] },
  { setsDetail: [{ completedAt: at(160), restTakenS: 20 }] }, // un autre exercice, validé entre les deux
];
annotateSets(ex, series, T0);
const [s1, s3] = ex[0].setsDetail, s2 = ex[1].setsDetail[0];
assert.equal(s1.hrPeak, 156); assert.equal(s1.hrEndRest, 118);
assert.equal(s2.hrPeak, 160, "fenêtre de la série 2 : après la fin du repos 1, le pic de la série 1 n'y entre pas"); assert.equal(s2.hrEndRest, 125);
assert.equal(s3.hrPeak, 150); assert.equal(s3.hrEndRest, undefined, "dernière série sans repos : pas de FC de fin de repos");
// sans série, ou sans instant de validation : rien n'est écrit
const bare = [{ setsDetail: [{ reps: 8 }] }];
annotateSets(bare, series, T0); annotateSets(ex.map(() => ({ setsDetail: [{ completedAt: at(100) }] })), [], T0);
assert.deepEqual(bare[0].setsDetail, [{ reps: 8 }]);
// trou de capteur : pas de pic inventé
const gap = [{ setsDetail: [{ completedAt: at(100), restTakenS: 30 } as HrSet] }];
annotateSets(gap, series.filter((x) => x.t < 20 || x.t > 200), T0);
assert.equal(gap[0].setsDetail[0].hrPeak, undefined); assert.equal(gap[0].setsDetail[0].hrEndRest, undefined);

// ── Baisse moyenne pendant les repos ──
assert.equal(restDrop([s1, s2]), null, "moins de 3 séries mesurées : pas de moyenne");
assert.deepEqual(restDrop([s1, s2, { hrPeak: 150, hrEndRest: 120 }]), { bpm: 34, sets: 3 }, "(156-118 + 160-125 + 150-120) / 3 = 34,33");
assert.deepEqual(setsOf([[{ hrPeak: 1 }], null, [{ hrPeak: 2 }, { hrPeak: 3 }]]).length, 3);

// ── Série seconde par seconde ──
assert.deepEqual(toSecondSeries([]), []);
assert.deepEqual(toSecondSeries([{ t: 1, bpm: 100 }, { t: 3, bpm: 110 }]), [0, 100, 100, 110]);
const held = toSecondSeries([{ t: 0, bpm: 100 }, { t: 30, bpm: 120 }]);
assert.equal(held[10], 100); assert.equal(held[11], 0, "trou de plus de 10 s : plus de mesure"); assert.equal(held[30], 120);

// ── Envoi par le SetLogger ──
const lift: LiftExercise = { name: "Dips", sets: 2, reps: 8, kg: 0, step: 1, restS: 30, bodyweight: true, prev: [], done: [{ reps: 8, kg: 0, at: T0 + 100000, restS: 30 }, { reps: 7, kg: 0 }] };
assert.deepEqual(toPayload(lift).setsDetail, [
  { reps: 8, loadKg: null, done: true, completedAt: at(100), restTakenS: 30 },
  { reps: 7, loadKg: null, done: true },
], "sans ceinture ni horodatage, la série part comme avant");

console.log("test-heart-rate : OK");
