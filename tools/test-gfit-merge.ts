// Lancer avec : npx tsx tools/test-gfit-merge.ts
import assert from "node:assert/strict";
import { groupFragments, groupPieces, mergedSpan } from "../lib/sync/google-fit-merge";
import { isSoftActivity, isTrainingActivity } from "../lib/sports";

const MIN = 60_000, t0 = Date.parse("2026-10-27T10:30:00Z");
const p = (id: string, type: number, from: number, to: number) => ({ id, type, startMs: t0 + from * MIN, endMs: t0 + to * MIN });

// Une course coupée par deux pauses (3 min, puis 8 min) : une seule sortie.
let g = groupPieces([p("c", 8, 30, 45), p("a", 8, 0, 12), p("b", 8, 15, 22)]);
assert.equal(g.length, 1);
assert.deepEqual(g[0].map((x) => x.id), ["a", "b", "c"], "ordre chronologique, premier morceau en tête");
const s = mergedSpan(g[0]);
assert.equal(s.startMs, t0);
assert.equal(s.endMs, t0 + 45 * MIN);
assert.equal(s.movingS, (12 + 7 + 15) * 60, "temps en mouvement = somme des morceaux");
assert.equal(s.elapsedS, 45 * 60, "temps écoulé = fin − début");

// 10 min ou plus d'écart : deux sorties.
g = groupPieces([p("a", 8, 0, 12), p("b", 8, 22, 30)]);
assert.equal(g.length, 2);

// Une marche pendant la pause ne coupe pas la course ; deux types ne se mélangent jamais.
g = groupPieces([p("a", 8, 0, 12), p("w", 7, 12, 16), p("b", 8, 17, 30)]);
assert.deepEqual(g.map((x) => x.map((y) => y.id)), [["a", "b"], ["w"]]);

// Un morceau inclus dans le précédent ne fait pas reculer la fin.
g = groupPieces([p("a", 8, 0, 30), p("b", 8, 5, 10), p("c", 8, 35, 40)]);
assert.equal(g.length, 1);
assert.equal(mergedSpan(g[0]).endMs, t0 + 40 * MIN);
assert.equal(mergedSpan(g[0]).movingS, 35 * 60, "le morceau inclus ne compte pas deux fois");

// Activités déjà en base : seulement les groupes d'au moins deux morceaux, par utilisateur.
const act = (userId: string, type: string, from: number, min: number) => ({ userId, type, startedAt: new Date(t0 + from * MIN), movingTimeS: min * 60, elapsedTimeS: null });
const groups = groupFragments([act("u", "RUN", 0, 12), act("u", "RUN", 15, 7), act("v", "RUN", 25, 10), act("u", "RUN", 120, 30)]);
assert.equal(groups.length, 1);
assert.equal(groups[0].length, 2);

// Une course Google Fit compte comme entraînement ; vélotaf et marche restent « doux ».
assert.equal(isTrainingActivity({ type: "RUN", source: "google-fit", dedupeKey: "gfit-seg-8-1", title: "Course à pied" }), true);
assert.equal(isSoftActivity({ type: "EBIKE", source: "google-fit", dedupeKey: "gfit-seg-1-1", title: "Vélotaf" }), true);
assert.equal(isSoftActivity({ type: "WALK", source: "google-fit", dedupeKey: "gfit-seg-7-1", title: "Marche" }), true);

console.log("google fit, morceaux recollés : ok");
