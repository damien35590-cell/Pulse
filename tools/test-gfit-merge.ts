// Lancer avec : npx tsx tools/test-gfit-merge.ts
import assert from "node:assert/strict";
import { groupFragments, groupPieces, leftoverGroups, mergedSpan, planSession, type Existing } from "../lib/sync/google-fit-merge";
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

// ── Sessions d'abord : le 27/10, une course de 40 min (session 12:35 → 13:16) que les segments découpent en marche / course / course / marche ──
{
  const at = (h: number, m: number, sec = 0) => Date.parse("2026-10-27T00:00:00+01:00") + ((h * 60 + m) * 60 + sec) * 1000;
  const run = { id: "sess-1", startMs: at(12, 35, 10), endMs: at(13, 15, 39) };
  const segs = [
    { type: 7, startMs: at(12, 36, 4), endMs: at(12, 46, 57) }, { type: 8, startMs: at(12, 49, 50), endMs: at(13, 0, 46) },
    { type: 8, startMs: at(13, 0, 46), endMs: at(13, 8, 16) }, { type: 7, startMs: at(13, 8, 17), endMs: at(13, 16, 23) },
    { type: 1, startMs: at(17, 30), endMs: at(17, 45) }, { type: 1, startMs: at(17, 48), endMs: at(18, 0) }, { type: 7, startMs: at(18, 5), endMs: at(18, 20) },
  ].map((x, i) => ({ ...x, id: `seg-${i}` }));
  // Les segments qui recouvrent la session, quel que soit leur type, disparaissent ; le reste est recollé par type.
  const left = leftoverGroups(segs, [run]);
  assert.deepEqual(left.map((g) => g.map((x) => x.id)), [["seg-4", "seg-5"], ["seg-6"]], "session + segments mêlés → une seule sortie ; hors session : vélotaf recollé, marche à part");
  assert.deepEqual(leftoverGroups(segs, []).map((g) => g.map((x) => x.id)), [["seg-0"], ["seg-1", "seg-2"], ["seg-3"], ["seg-4", "seg-5"], ["seg-6"]], "sans session : recollés par type, écart < 10 min");

  // Avant le rattrapage : 4 activités nées des segments recouvrent la session → à reconstruire (la synchro n'y touche pas).
  const segActs: Existing[] = segs.slice(0, 4).map((x) => ({ id: x.id, dedupeKey: `gfit-${x.id}`, mergedSourceIds: [], startMs: x.startMs, endMs: x.endMs }));
  const before = planSession(run, segActs);
  assert.equal(before.status, "replace");
  assert.deepEqual(before.replaces, ["seg-0", "seg-1", "seg-2", "seg-3"]);
  // Après : seule l'activité de la session reste → une nouvelle synchro ne crée rien.
  const after = planSession(run, [{ id: "a1", dedupeKey: "gfit-sess-1", mergedSourceIds: [], startMs: run.startMs, endMs: run.endMs }]);
  assert.equal(after.status, "exists");
  assert.equal(after.ownId, "a1");
  // Un vélotaf (segments) qui ne recouvre pas la session n'est pas concerné.
  assert.equal(planSession(run, [{ id: "v", dedupeKey: "gfit-seg-1-1", mergedSourceIds: [], startMs: at(17, 30), endMs: at(18, 0) }]).status, "create");
}

console.log("google fit, morceaux recollés : ok");
