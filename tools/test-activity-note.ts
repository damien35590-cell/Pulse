// Lancer avec : npx tsx tools/test-activity-note.ts
import assert from "node:assert/strict";
import { activityNote, type NoteInput } from "../lib/coach/activity-note";
import { validateComment } from "../lib/coach/comment-guard";

const run = (o: Partial<NoteInput> = {}): NoteInput => ({ type: "RUN", title: "Footing", cls: "easy", weekRank: 1, ...o });
const lift = (o: Partial<NoteInput> = {}): NoteInput => ({ type: "WORKOUT", title: "Haut du corps", workoutKind: "HAUT", weekRank: 1, ...o });
const sentences = (s: string) => s.split(/(?<=\.)\s/).length;

// ── Course ──
assert.equal(activityNote(run({ next: { kind: "key", days: 2, weekday: "jeudi" } })), "Footing bien placé, garde les jambes fraîches pour la séance clé de jeudi.");
assert.equal(activityNote(run({ next: { kind: "long", days: 1, weekday: "samedi" } })), "Footing bien placé, garde les jambes fraîches pour la sortie longue de demain.");
assert.equal(activityNote(run({ weekRank: 2 })), "Footing en endurance : c'est ce volume facile qui fait progresser. 2ᵉ sortie de la semaine, dans la cible de 2 à 3.");
assert.match(activityNote(run({ weekRank: 4 }))!, /au-delà de la cible/);
assert.match(activityNote(run({ feeling: "HARD" }))!, /^Footing ressenti difficile/, "ressenti dur : on lève le pied, sans reproche");
assert.match(activityNote(run({ cls: "key" }))!, /^Séance clé faite/);
assert.match(activityNote(run({ cls: "key", next: { kind: "key", days: 1, weekday: "mercredi" } }))!, /avant la séance clé de demain/);
assert.match(activityNote(run({ cls: "long" }))!, /^Sortie longue faite/);

// ── Muscu (hybride : pas de bas du corps la veille d'une séance clé) ──
assert.match(activityNote(lift({ workoutKind: "BAS", next: { kind: "key", days: 1, weekday: "jeudi" } }))!, /^Bas du corps la veille de la séance clé/);
assert.match(activityNote(lift({ workoutKind: "HAUT", next: { kind: "long", days: 1, weekday: "dimanche" } }))!, /les jambes restent fraîches/);
assert.match(activityNote(lift({ weekRank: 3 }))!, /3ᵉ séance de muscu de la semaine : la cible de 2 à 3 est atteinte\./);

// ── Jamais de commentaire sur le vélotaf ni la marche ──
assert.equal(activityNote({ type: "WALK", title: "Marche", weekRank: 1 }), null);
assert.equal(activityNote({ type: "EBIKE", title: "Trajet", weekRank: 1 }), null);
assert.equal(activityNote({ type: "RIDE", title: "Vélotaf du matin", weekRank: 1 }), null);
assert.equal(activityNote({ type: "RIDE", title: "Sortie", source: "google-fit", weekRank: 1 }), null);
assert.match(activityNote({ type: "RIDE", title: "Sortie vélo", weekRank: 1 })!, /^Sortie vélo/);
assert.equal(activityNote({ type: "HIKE", title: "Rando", weekRank: 1 }), null);

// ── Ton : 1 à 2 phrases, tutoiement, garde-fou des commentaires (pas d'emoji, d'exclamation ni de cheerleader) ──
const all: NoteInput[] = [];
for (const cls of ["easy", "long", "key"] as const)
  for (const feeling of [null, "HARD"])
    for (const weekRank of [1, 2, 3, 4])
      for (const next of [null, { kind: "key" as const, days: 1, weekday: "jeudi" }, { kind: "long" as const, days: 3, weekday: "samedi" }])
        all.push(run({ cls, feeling, weekRank, next }));
for (const workoutKind of ["HAUT", "BAS", "LIBRE", null] as const)
  for (const weekRank of [1, 2, 3])
    for (const next of [null, { kind: "key" as const, days: 1, weekday: "jeudi" }]) all.push(lift({ workoutKind, weekRank, next }));
for (const i of all) {
  const t = activityNote(i)!;
  assert.ok(t, `note attendue : ${JSON.stringify(i)}`);
  assert.ok(sentences(t) <= 2, `au plus 2 phrases : ${t}`);
  assert.deepEqual(validateComment(t, "validated").reasons, [], t);
  assert.doesNotMatch(t, /\bvous\b|\bvotre\b/i, "tutoiement");
}

console.log("note du coach : ok");
