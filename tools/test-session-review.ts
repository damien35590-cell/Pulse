// Lancer avec : npx tsx tools/test-session-review.ts
import assert from "node:assert/strict";
import type { StrengthRow } from "../lib/analytics/strength-rows";
import { reviewSession, sessionTotals, type ReviewInput } from "../lib/workout/session-review";

const d = (iso: string) => new Date(iso + "T08:00:00Z");
const past = (id: string, day: string, name: string, sets: number, reps: number, done: number[]): StrengthRow =>
  ({ activityId: id, startedAt: d(day), name, sets, reps, loadKg: null, setsDetail: done.map((r) => ({ reps: r, loadKg: null, done: true })) });
const ex = (name: string, sets: number, reps: number, detail: { reps: number; done?: boolean; isWarmup?: boolean; hard?: boolean }[] | null, restS: number | null = 30): ReviewInput =>
  ({ id: name, activityId: "now", name, sets, reps, loadKg: null, restS, comment: null, setsDetail: detail?.map((s) => ({ loadKg: null, done: true, ...s })) ?? null });
const six = (n: number) => Array.from({ length: 6 }, () => ({ reps: n }));
const today = d("2026-10-20");

// Progrès : toutes les séries à la cible → +1 rép, écart positif avec la dernière fois.
let [r] = reviewSession([ex("B2 - dips", 6, 10, six(10))], today, new Map([["lafay:b", [past("p1", "2026-10-16", "B2 - dips", 6, 9, [9, 9, 9, 9, 9, 9])]]]));
assert.equal(r.code, "B2");
assert.equal(r.total, 60);
assert.equal(r.delta, 6);
assert.deepEqual(r.status, { label: "Progrès", tone: "good" });
assert.equal(r.next, "Prochaine fois : 6 × 11");
assert.equal(r.targetText, "6 × 10 · repos 30 s");

// Séries incomplètes : la non faite reste visible (done false) mais n'entre pas dans le total ; échauffement écarté.
[r] = reviewSession([ex("B2 - dips", 6, 10, [{ reps: 5, isWarmup: true }, { reps: 10 }, { reps: 10 }, { reps: 9 }, { reps: 8 }, { reps: 7 }, { reps: 0, done: false }])], today, new Map());
assert.equal(r.sets.length, 6, "échauffement exclu");
assert.deepEqual(r.sets.map((s) => s.done), [true, true, true, true, true, false]);
assert.equal(r.total, 44);
assert.equal(r.delta, null, "sans historique : pas d'écart");
assert.deepEqual(r.status, { label: "Stable", tone: "neutral" }, "cible manquée sans historique : même cible");
assert.equal(r.next, "Prochaine fois : même cible, 6 × 10");

// Blocage : deux séances sans gain de total.
[r] = reviewSession([ex("B2 - dips", 6, 10, [{ reps: 10 }, { reps: 10 }, { reps: 9 }, { reps: 9 }, { reps: 8 }, { reps: 8 }])], today, new Map([["lafay:b", [
  past("p2", "2026-10-16", "B2 - dips", 6, 10, [10, 10, 9, 9, 9, 8]),
  past("p1", "2026-10-12", "B2 - dips", 6, 10, [10, 10, 10, 9, 9, 8]),
]]]));
assert.equal(r.delta, -1);
assert.deepEqual(r.status, { label: "Blocage 2/2", tone: "warn" });
assert.match(r.next ?? "", /^Prochaine fois : on repart à 6 × 7$/);
[r] = reviewSession([ex("B2 - dips", 6, 10, [{ reps: 10 }, { reps: 10 }, { reps: 9 }, { reps: 9 }, { reps: 9 }, { reps: 8 }])], today, new Map([["lafay:b", [past("p1", "2026-10-16", "B2 - dips", 6, 10, [10, 10, 9, 9, 9, 8])]]]));
assert.deepEqual(r.status, { label: "Blocage 1/2", tone: "warn" });

// Plafond atteint : variante suivante proposée.
[r] = reviewSession([ex("B1 - dips", 6, 12, six(12))], today, new Map());
assert.match(r.next ?? "", /^Variante suivante proposée : B2 à 6 × \d+$/);

// Au chrono : secondes, cible « 3 × 10 s », à part des répétitions.
const timed = reviewSession([ex("E4 - flexions latérales", 3, 10, [{ reps: 10 }, { reps: 10 }, { reps: 8 }], null), ex("A3 - pompes", 2, 12, null)], today, new Map());
assert.equal(timed[0].timed, true);
assert.equal(timed[0].targetText, "3 × 10 s");
assert.equal(timed[0].title, "Flexions latérales jambes écartées");
assert.equal(timed[0].subtitle, "Alterné droite / gauche, durée");
assert.deepEqual(sessionTotals(timed), { exercises: 2, sets: 5, reps: 24, seconds: 28 });

// Hors Lafay : pas de code ni de cible suivante, état d'après le total.
[r] = reviewSession([ex("Développé couché", 4, 8, [{ reps: 8 }, { reps: 8 }, { reps: 8 }, { reps: 8 }])], today, new Map([["developpe couche", [past("p1", "2026-10-16", "Développé couché", 4, 8, [8, 8, 7, 7])]]]));
assert.equal(r.code, null);
assert.equal(r.next, null);
assert.equal(r.delta, 2);
assert.deepEqual(r.status, { label: "Progrès", tone: "good" });

console.log("session-review : ok");
