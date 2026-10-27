// Lancer avec : npx tsx tools/test-sports.ts
import assert from "node:assert/strict";
import { isTrainingActivity } from "../lib/sports";

const a = (type: string, extra: object = {}) => ({ type, title: "Sortie", source: "strava", dedupeKey: null, ...extra });
// Comptent : les quatre sports de l'app
for (const t of ["RUN", "RIDE", "HIKE", "WORKOUT"]) assert.equal(isTrainingActivity(a(t)), true, t);
// Ne comptent pas : activités douces, vélotaf non reclassé, natation / autre (absents de la liste des Activités)
for (const t of ["WALK", "EBIKE", "SWIM", "OTHER"]) assert.equal(isTrainingActivity(a(t)), false, t);
assert.equal(isTrainingActivity(a("RIDE", { title: "Vélotaf" })), false);
assert.equal(isTrainingActivity(a("RIDE", { source: "google-fit" })), false);
assert.equal(isTrainingActivity(a("RUN", { source: "google-fit" })), true, "une vraie course Google Fit compte");
console.log("sports : tout est vert");
