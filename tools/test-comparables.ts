// Lancer avec : npx tsx tools/test-comparables.ts
import assert from "node:assert/strict";
import { classContext, contextChips, paceInsight, paceWording, selectComparables, sessionClass, type Candidate } from "../lib/activity/comparables";

const TZ = "Europe/Paris";
const T = new Date("2026-10-13T10:36:00Z"); // mardi
const daysAgo = (n: number, from = T) => new Date(+from - n * 86_400_000);
let n = 0;
/** Footing : 8 km à `pace` s/km. */
const run = (o: Partial<Candidate> & { pace?: number } = {}): Candidate => {
  const distanceM = o.distanceM ?? 8000, pace = o.pace ?? 330;
  return { id: o.id ?? `a${++n}`, type: "RUN", startedAt: daysAgo(7), distanceM, movingTimeS: Math.round((distanceM / 1000) * pace), ...o };
};
const target = run({ id: "me", startedAt: T, pace: 355 });

// ── Genre de séance ──
assert.equal(sessionClass(run({ planned: { kind: "LONG_RUN", isKeySession: false } })), "long", "programme : sortie longue");
assert.equal(sessionClass(run({ planned: { kind: "EASY", isKeySession: true } })), "key", "séance clé du programme");
assert.equal(sessionClass(run({ planned: { kind: "INTERVALS_SHORT", isKeySession: false } })), "key");
assert.equal(sessionClass(run({ rpe: 8 })), "key", "effort ressenti élevé");
assert.equal(sessionClass(run({ avgHr: 172 }), { hrMax: 190 }), "key", "FC ≥ 85 % de la FC max");
assert.equal(sessionClass(run({ avgHr: 150 }), { hrMax: 190 }), "easy");
assert.equal(sessionClass(run({ race: true })), "key", "course");
assert.equal(sessionClass(run({ distanceM: 16000 }), { medianDistanceM: 8000 }), "long", "≥ 1,4 × la médiane");
assert.equal(sessionClass(run({ distanceM: 10000 }), { medianDistanceM: 8000 }), "easy");
assert.equal(sessionClass(run({ movingTimeS: 95 * 60 })), "long", "≥ 90 min");

// ── Sélection des comparables ──
const keep = [run({ id: "ok1" }), run({ id: "ok2", distanceM: 10400 }), run({ id: "ok3", distanceM: 5600, startedAt: daysAgo(89) })];
const drop = [
  run({ id: "far", distanceM: 10500 }), // +31 %
  run({ id: "short", distanceM: 5500 }), // −31 %
  run({ id: "old", startedAt: daysAgo(91) }),
  run({ id: "after", startedAt: new Date(+T + 3_600_000) }), // postérieure : pas un « passé »
  run({ id: "ride", type: "RIDE" }),
  run({ id: "hard", rpe: 8 }), // séance de qualité ≠ footing
  { ...target }, // l'activité elle-même
];
const pool = [...keep, ...drop];
const ctx = { hrMax: 190 };
assert.deepEqual(selectComparables(target, pool, ctx).map((c) => c.id).sort(), ["ok1", "ok2", "ok3"]);
assert.deepEqual(selectComparables(run({ id: "q", startedAt: T, rpe: 9 }), pool, ctx).map((c) => c.id), ["hard"], "qualité contre qualité");

// ── Formulation ──
assert.deepEqual(paceWording(25, "footings"), { tone: "warn", diffS: 25, text: "25 s/km plus lent que tes footings similaires", delta: "+25 s/km" });
assert.deepEqual(paceWording(-12.4, "footings"), { tone: "good", diffS: -12, text: "12 s/km plus rapide que tes footings similaires", delta: "−12 s/km" });
assert.equal(paceWording(2.4, "footings").tone, "neutral", "2 s/km : dans la moyenne");
assert.equal(paceWording(-2.6, "footings").tone, "good", "−2,6 arrondi à −3 : plus rapide");
assert.equal(paceWording(2.6, "footings").text, "3 s/km plus lent que tes footings similaires", "seuil à 3 s/km après arrondi");
assert.equal(paceWording(0, "footings").text, "Dans ta moyenne habituelle");
assert.equal(paceWording(0, "footings").delta, "±0 s/km");

// ── Insight complet ──
const ins = paceInsight(target, pool, ctx)!;
assert.ok(ins, "3 comparables : comparaison");
// moyenne des allures : ok1 330, ok2 330, ok3 330 → +25 s/km
assert.equal(ins.text, "25 s/km plus lent que tes footings similaires");
assert.equal(ins.basis, "Comparé à 3 footings des 90 derniers jours");
assert.equal(paceInsight(target, [keep[0], keep[1], ...drop], ctx), null, "2 comparables : pas de comparaison");
assert.equal(paceInsight({ ...target, type: "RIDE" }, pool.map((c) => ({ ...c, type: "RIDE" })), ctx), null, "pas d'allure à vélo");
assert.equal(paceInsight(run({ id: "l", startedAt: T, planned: { kind: "LONG_RUN", isKeySession: false } }), [
  run({ planned: { kind: "LONG_RUN", isKeySession: false }, pace: 340 }), run({ planned: { kind: "LONG_RUN", isKeySession: false }, pace: 340 }), run({ planned: { kind: "LONG_RUN", isKeySession: false }, pace: 340 }),
], ctx)?.text, "10 s/km plus rapide que tes sorties longues similaires");

// ── Pastilles ──
const chips = (t: Candidate, p: Candidate[], records?: string[]) => contextChips(t, p, { tz: TZ, records, ctx: classContext(t, p) });
const mon = new Date("2026-10-12T07:00:00Z"), prevSun = new Date("2026-10-11T07:00:00Z");
assert.deepEqual(chips(target, [run({ startedAt: mon, distanceM: 9000 }), run({ startedAt: prevSun, distanceM: 9000 })]), ["2ᵉ sortie de la semaine"], "lundi compté, dimanche d'avant non");
assert.deepEqual(chips(target, [run({ startedAt: new Date(+T + 86_400_000) })]), [], "sortie postérieure dans la semaine : 1re");
assert.deepEqual(chips(target, [run({ startedAt: new Date("2026-10-02T07:00:00Z"), distanceM: 7000 }), run({ startedAt: new Date("2026-10-05T07:00:00Z"), distanceM: 6000 })]), ["Plus long footing du mois"]);
assert.deepEqual(chips(target, [run({ startedAt: new Date("2026-10-02T07:00:00Z"), distanceM: 7000 })]), [], "pas assez de sorties dans le mois");
assert.deepEqual(chips(target, [run({ startedAt: new Date("2026-10-02T07:00:00Z"), distanceM: 7000 }), run({ startedAt: new Date("2026-10-28T07:00:00Z"), distanceM: 9000 })]), [], "battu plus tard dans le mois");
assert.deepEqual(chips(target, [run({ startedAt: new Date("2026-09-28T07:00:00Z"), distanceM: 7000 }), run({ startedAt: new Date("2026-09-29T07:00:00Z"), distanceM: 6000 })]), [], "autre mois");
assert.deepEqual(chips(target, [], ["BEST_5K", "LONGEST_DISTANCE"]), ["Record sur 5 km"]);
assert.deepEqual(chips(target, [], ["BEST_5K", "BEST_10K"]), ["Record sur 10 km"], "le plus long record d'abord");
assert.equal(chips(target, [run({ startedAt: mon }), run({ startedAt: new Date("2026-10-02T07:00:00Z"), distanceM: 7000 }), run({ startedAt: new Date("2026-10-05T07:00:00Z"), distanceM: 6000 })], ["BEST_5K"]).length, 2, "au plus 2 pastilles");
const lift = (o: Partial<Candidate>): Candidate => ({ id: `w${++n}`, type: "WORKOUT", startedAt: T, distanceM: 0, movingTimeS: 3600, ...o });
assert.deepEqual(contextChips(lift({ id: "w" }), [lift({ startedAt: mon })], { tz: TZ }), ["2ᵉ séance de la semaine"]);

console.log("comparables : ok");
