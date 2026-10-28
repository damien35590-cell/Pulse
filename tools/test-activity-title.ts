// Lancer avec : npx tsx tools/test-activity-title.ts
import assert from "node:assert/strict";
import { displayTitle, isAutoTitle, planTitle } from "../lib/activity/title";
import { summaryData, type SummaryActivity } from "../lib/activity/summary";

const vma = { title: "VMA courte · 8 × 30/30" };

// Titre automatique + séance du programme : le nom de la séance prime.
assert.equal(displayTitle({ title: "Morning Run", plannedSession: vma }), "VMA courte · 8 × 30/30", "le nom de la séance prime sur un titre Strava par défaut");
assert.equal(displayTitle({ title: "Morning Run", plannedSession: null }), "Morning Run", "sans séance liée : titre courant");
assert.equal(displayTitle({ title: "Morning Run" }), "Morning Run");
assert.equal(displayTitle({ title: "Morning Run", plannedSession: { title: "  " } }), "Morning Run", "nom vide : repli");
assert.equal(planTitle({ title: "Running", plannedSession: { title: "Footing" } }), "Footing");

// Titre saisi par l'utilisateur : il gagne toujours, même s'il ressemble à un titre automatique.
assert.equal(displayTitle({ title: "Sortie avec Paul", titleEdited: true, plannedSession: vma }), "Sortie avec Paul", "titre saisi : il prime");
assert.equal(displayTitle({ title: "Running", titleEdited: true, plannedSession: vma }), "Running", "titre saisi identique au sport : il prime quand même");
assert.equal(planTitle({ title: "Course à pied", titleEdited: true, plannedSession: vma }), null);
// Activités existantes (titleEdited = false) : un titre écrit à la main ailleurs (Strava…) reste.
assert.equal(displayTitle({ title: "Tour du lac avec Léa", titleEdited: false, plannedSession: vma }), "Tour du lac avec Léa", "titre écrit à la main : gardé");
assert.equal(displayTitle({ title: "Fractionné piste", plannedSession: vma }), "Fractionné piste");

// Titres automatiques reconnus
for (const t of [
  "Running", "Course à pied", "Course", "Run", "Vélo", "Musculation", "Randonnée", "Marche", "Séance", "Sortie vélo", "Vélo virtuel", "Activité importée", "Activité RUN", "",
  "Morning Run", "Afternoon Ride", "Lunch Run", "Evening Weight Training", "Night Walk",
  "Course à pied le midi", "Course à pied le matin", "Course à pied dans l'après-midi", "Course à pied dans l’après-midi", "Course à pied en soirée", "Course du matin",
  "Running du matin", "Running de l’après-midi", "Running du soir", "Sortie à vélo le matin", "Course à pied nocturne",
  "Rennes Running", "Cesson-Sévigné - Course à pied",
]) assert.ok(isAutoTitle(t), `automatique : « ${t} »`);
// Titres écrits par quelqu'un
for (const t of ["Footing", "Sortie longue", "Fractionné piste", "Tour du lac avec Léa", "10 × 400 m", "Course de Noël", "Marathon de Paris", "Sortie avec Paul", "Run club du jeudi"])
  assert.ok(!isAutoTitle(t), `écrit à la main : « ${t} »`);

// Carte du fil
const base: SummaryActivity = { id: "a", type: "RUN", title: "Morning Run", story: null, startedAt: new Date("2026-10-27T07:00:00Z"), distanceM: 8000, movingTimeS: 2400, elevationGainM: 0, polyline: null };
const linked = summaryData({ ...base, plannedSession: { kind: "EASY", title: "Footing" } }, undefined, "Europe/Paris");
assert.equal(linked.title, "Footing");
assert.match(linked.when, /^Running · /, "le sport passe dans la ligne de la date");
const plain = summaryData(base, undefined, "Europe/Paris");
assert.equal(plain.title, "Morning Run");
assert.ok(!plain.when.startsWith("Running"));
const edited = summaryData({ ...base, title: "Footing avec Léa", titleEdited: true, plannedSession: { kind: "EASY", title: "Footing" } }, undefined, "Europe/Paris");
assert.equal(edited.title, "Footing avec Léa", "carte du fil : le titre saisi prime");
assert.ok(!edited.when.startsWith("Running"), "titre saisi : la date reste seule");
