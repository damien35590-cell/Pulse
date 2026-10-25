// Lancer avec : npx tsx tools/test-routes.ts
import assert from "node:assert/strict";
import {
  ascentOf, bikeSpeed, buildProfile, DEFAULT_BIKE_KMH, DEFAULT_RUN_PACE_S_KM, estimateMinutes, kmForMinutes, median, runPace, withinTolerance,
  type HistoryActivity,
} from "../lib/routes/estimate";
import { isSoftActivity } from "../lib/sports";
import { extraShare } from "../lib/routes/generate";
import { parseOverpass, tilesFor, mergeTiles } from "../lib/routes/overpass";
import { classifyPoi } from "../lib/routes/poi";
import { indexOsm, overlap, pickThree, sampleRoute, scoreRoute, whyText } from "../lib/routes/score";
import { gpxFileName, toGpx } from "../lib/routes/gpx";
import { mergePlaces, parseEntreprises, parseIgnCompletion, parseIgnSearch, parsePhoton } from "../lib/routes/places";

const now = new Date("2026-10-20T10:00:00Z");
const ago = (days: number, type: string, km: number, min: number, extra: Partial<HistoryActivity> = {}): HistoryActivity =>
  ({ type, startedAt: new Date(+now - days * 864e5), distanceM: km * 1000, movingTimeS: min * 60, startLat: 48.1, source: "fit", ...extra });

// ── Médiane ──
assert.equal(median([]), null);
assert.equal(median([3, 1, 2]), 2);
assert.equal(median([4, 1, 3, 2]), 2.5);

// ── Allure course : 90 jours, ≥ 3 km, hors activités douces ──
const runs = [ago(2, "RUN", 10, 50), ago(9, "RUN", 8, 44), ago(20, "RUN", 5, 30), ago(30, "RUN", 2, 8), ago(120, "RUN", 10, 40), ago(5, "WALK", 6, 70)];
assert.equal(runPace(runs, now).samples, 3); // le 2 km, la sortie de 120 j et la marche sont écartés
assert.equal(runPace(runs, now).paceSKm, 330); // médiane de 300, 330, 360 s/km
assert.deepEqual(runPace(runs.slice(0, 2), now), { paceSKm: DEFAULT_RUN_PACE_S_KM, samples: 0 }); // moins de 3 sorties → 5'30

// ── Vitesse vélo : hors vélotaf, E-bike, Google Fit, home trainer ──
const rides = [
  ago(1, "RIDE", 50, 120), ago(4, "RIDE", 30, 72), ago(8, "RIDE", 40, 100),
  ago(2, "RIDE", 12, 20, { source: "google-fit" }), ago(3, "RIDE", 15, 25, { dedupeKey: "gfit-123" }), ago(3, "RIDE", 14, 30, { title: "Vélotaf du matin" }),
  ago(6, "EBIKE", 20, 40), ago(7, "RIDE", 30, 60, { startLat: null }),
];
assert.equal(bikeSpeed(rides, now).samples, 3);
assert.equal(bikeSpeed(rides, now).speedKmh, 25); // médiane de 25, 25, 24 km/h
assert.equal(bikeSpeed([], now).speedKmh, DEFAULT_BIKE_KMH);

// ── Formules de temps ──
const run = buildProfile("RUN", undefined, [], now), road = buildProfile("RIDE", "road", [], now), trail = buildProfile("RIDE", "trail", [], now);
assert.equal(estimateMinutes(run, 10, 0), 55); // 10 km à 5'30
assert.equal(estimateMinutes(run, 10, 200), 66); // + 2 km équivalents
assert.equal(estimateMinutes(road, 22, 0), 60);
assert.equal(estimateMinutes(road, 22, 300), 78); // + 3 × 6 min
assert.ok(estimateMinutes(trail, 22, 0) > 60, "les chemins sont plus lents");
assert.ok(Math.abs(kmForMinutes(run, 55) - 10) < 1e-9);
assert.ok(Math.abs(estimateMinutes(road, kmForMinutes(road, 90, 10), 10 * kmForMinutes(road, 90, 10)) - 90) < 1e-9, "inverse exact");
assert.ok(withinTolerance(66, 60) && !withinTolerance(67, 60) && withinTolerance(54, 60));

// ── D+ avec hystérésis : le bruit de ±2 m ne compte pas ──
assert.equal(ascentOf([10, 12, 10, 12, 10, 12]), 0);
assert.equal(ascentOf([10, 20, 15, 30]), 25);
assert.equal(ascentOf([]), 0);

// ── Part de distance d'un extra ORS ──
const line: [number, number, number][] = [[48, -1.5, 0], [48.001, -1.5, 0], [48.002, -1.5, 0], [48.003, -1.5, 0]];
assert.ok(Math.abs(extraShare(line, [[0, 1, 2], [1, 3, 4]], [2]) - 1 / 3) < 1e-6);
assert.equal(extraShare(line, undefined, [1]), 0);

// ── Classement des points d'intérêt ──
assert.equal(classifyPoi({ tourism: "viewpoint" }), "viewpoint");
assert.equal(classifyPoi({ historic: "wayside_cross" }), "cross");
assert.equal(classifyPoi({ historic: "tomb" }), null);
assert.equal(classifyPoi({ historic: "yes" }), "historic");
assert.equal(classifyPoi({ man_made: "tower", "tower:type": "communication" }), null);
assert.equal(classifyPoi({ amenity: "drinking_water" }), "drinking_water");
assert.equal(classifyPoi({ amenity: "bench" }), null);

// ── Tuiles ──
assert.equal(tilesFor({ s: 48.11, w: -1.62, n: 48.14, e: -1.56 }).length, 2); // 1 rang × 2 colonnes
assert.equal(tilesFor({ s: 48.11, w: -1.62, n: 48.16, e: -1.56 }).length, 4);

// ── Lecture Overpass : forêt fermée, relation coupée, rivière, POI, itinéraire balisé ──
const sq = (lat: number, lng: number, d: number) => [{ lat, lon: lng }, { lat, lon: lng + d }, { lat: lat + d, lon: lng + d }, { lat: lat + d, lon: lng }, { lat, lon: lng }];
const osm = parseOverpass([
  { type: "way", id: 1, tags: { landuse: "forest" }, geometry: sq(48.1, -1.6, 0.01) },
  { type: "relation", id: 2, tags: { natural: "water", type: "multipolygon" }, members: [{ type: "way", role: "outer", geometry: [{ lat: 48.2, lon: -1.6 }, null, { lat: 48.21, lon: -1.6 }, { lat: 48.21, lon: -1.59 }] }] },
  { type: "way", id: 3, tags: { waterway: "river", name: "Le Meu" }, geometry: [{ lat: 48.1, lon: -1.58 }, { lat: 48.11, lon: -1.58 }] },
  { type: "node", id: 4, lat: 48.1025, lon: -1.595, tags: { tourism: "viewpoint", name: "Belvédère" } },
  { type: "way", id: 5, center: { lat: 48.105, lon: -1.585 }, tags: { historic: "castle" } },
  { type: "relation", id: 6, tags: { route: "hiking", name: "GR 39" }, members: [{ type: "way", role: "", geometry: [{ lat: 48.1, lon: -1.61 }, { lat: 48.12, lon: -1.61 }] }] },
  { type: "node", id: 7, lat: 48.0, lon: -1.0, tags: { amenity: "bench" } },
]);
assert.equal(osm.nature.length, 3);
assert.equal(osm.nature.find((f) => f.id === "w1")!.area, true);
assert.equal(osm.nature.find((f) => f.id === "r2")!.area, false); // coupée par la zone : seuls ses bords comptent
assert.equal(osm.nature.find((f) => f.id === "w3")!.area, false);
assert.equal(osm.pois.length, 2);
assert.equal(osm.routes[0].k, "foot");
assert.equal(mergeTiles([osm, osm]).nature.length, 3);

// ── Échantillonnage tous les 50 m ──
const straight: [number, number, number][] = [[48.1, -1.61, 0], [48.1, -1.6 - 0.0001, 0]]; // ≈ 737 m
assert.equal(sampleRoute(straight).length, 15);

// ── Notation : une boucle dans la forêt avec le belvédère, une sur la route ──
const loop = (lat: number, lng: number, d: number): [number, number, number][] =>
  [[lat, lng, 50], [lat, lng + d, 60], [lat + d, lng + d, 55], [lat + d, lng, 52], [lat, lng, 50]];
const base = { distanceM: 3000, estMinutes: 30, bigRoadPct: 0, unpavedPct: 0.5 };
const idx = indexOsm(osm, 48.1);
const inForest = scoreRoute({ ...base, coords: loop(48.102, -1.598, 0.006) }, idx, "RUN", 30);
const farAway = scoreRoute({ ...base, coords: loop(48.3, -1.4, 0.006), bigRoadPct: 0.6 }, idx, "RUN", 30);
assert.equal(inForest.scores.nature, 1);
assert.ok(inForest.scores.kinds.forest > 0.99);
assert.equal(inForest.scores.poiCount, 1); // le belvédère (à 50 m du tracé) ; le château est à plus de 75 m
assert.equal(inForest.pois[0].name, "Belvédère");
assert.equal(farAway.scores.nature, 0);
assert.ok(inForest.scores.global > farAway.scores.global);
assert.match(whyText(inForest.scores, inForest.pois), /^100 % en forêt · 1 point de vue/);
assert.match(whyText(scoreRoute({ ...base, coords: loop(48.3, -1.4, 0.006) }, null, "RUN", 30).scores, []), /OpenStreetMap n'a pas répondu/);

// ── Recouvrement et choix de 3 boucles différentes ──
assert.ok(overlap(inForest, inForest) > 0.99);
assert.equal(overlap(inForest, farAway), 0);
const twin = scoreRoute({ ...base, coords: loop(48.102, -1.598, 0.006) }, idx, "RUN", 30);
const other = scoreRoute({ ...base, coords: loop(48.2, -1.5, 0.006) }, idx, "RUN", 30);
const picks = pickThree([inForest, twin, farAway, other]);
assert.equal(picks.length, 3);
assert.equal(picks[0].label, "La nature");
assert.ok(!picks.some((p) => p.route === twin), "le doublon de la boucle en forêt est écarté");

// ── Lieux de départ (Photon) ──
const places = parsePhoton([
  { geometry: { coordinates: [-2.189, 48.017] }, properties: { osm_type: "W", osm_id: 42, name: "Forêt de Brocéliande", city: "Paimpont", county: "Ille-et-Vilaine", countrycode: "FR" } },
  { geometry: { coordinates: [-2.189, 48.017] }, properties: { osm_type: "R", osm_id: 43, name: "Forêt de Brocéliande", city: "Paimpont", county: "Ille-et-Vilaine", countrycode: "FR" } },
  { geometry: { coordinates: [-1.68, 48.11] }, properties: { street: "Rue de Brest", housenumber: "12", city: "Rennes", countrycode: "FR" } },
  { geometry: { coordinates: [-1.6, 48.2] }, properties: { city: "Rennes" } },
]);
assert.equal(places.length, 2, "doublon et résultat sans nom écartés");
assert.deepEqual(places[0], { id: "W42", name: "Forêt de Brocéliande", detail: "Paimpont, Ille-et-Vilaine", lat: 48.017, lng: -2.189 });
assert.equal(places[1].name, "12 Rue de Brest");
assert.equal(places[1].detail, "Rennes");

// ── Lieux de départ (IGN + fusion) ──
const ignC = parseIgnCompletion([
  { x: -1.7, y: 48.15, city: "Rennes", zipcode: "35000", kind: "locality", fulltext: "Le Gérec, 35000 Rennes" },
  { x: 0.81, y: 42.93, city: "Boutx", zipcode: "31160", kind: "locality", fulltext: "Girec, 31160 Boutx" },
  { x: 0, y: 0 },
]);
assert.equal(ignC.length, 2, "résultat sans libellé écarté");
assert.equal(ignC[0].name, "Le Gérec");
assert.equal(ignC[0].detail, "Rennes (35)");
const ignS = parseIgnSearch([{ geometry: { coordinates: [-2.19, 48.02] }, properties: { toponym: "Étang du Pas du Houx", city: ["Paimpont"], postcode: ["35380"] } }]);
assert.deepEqual([ignS[0].name, ignS[0].detail], ["Étang du Pas du Houx", "Paimpont (35)"]);
const merged = mergePlaces([ignC, places], "gerec", { lat: 48.11, lng: -1.68 });
assert.equal(merged[0].name, "Le Gérec", "nom contenant la saisie (sans accents) en premier");
assert.ok(merged[0].km! < 10, "distance au départ habituel calculée");
assert.equal(mergePlaces([[places[0]], [{ ...places[0], id: "x", lat: places[0].lat + 0.0005 }]], "foret").length, 1, "doublon à moins de 150 m écarté");

// ── Lieux de départ (entreprises) ──
const firms = parseEntreprises([
  { nom_complet: "GEIREC", matching_etablissements: [
    { adresse: "CS 76308 276 RUE DE CHATEAUGIRON 35000 RENNES", latitude: "48.0919165397561", longitude: "-1.62953879556544", libelle_commune: "RENNES", code_postal: "35000", etat_administratif: "A", statut_diffusion_etablissement: "O", siret: "42892951700020" },
    { adresse: "2 RUE BERTRAND ROBIDOU 35000 RENNES", latitude: "48.1", longitude: "-1.66", etat_administratif: "F", siret: "1" },
    { adresse: "1 RUE X 35000 RENNES", latitude: null, longitude: null, etat_administratif: "A", siret: "2" },
  ] },
]);
assert.equal(firms.length, 1, "établissements fermés ou sans coordonnées écartés");
assert.deepEqual([firms[0].name, firms[0].detail], ["Geirec", "276 Rue De Chateaugiron, Rennes (35)"]);
assert.equal(mergePlaces([[], [], firms], "geirec", { lat: 48.11, lng: -1.68 })[0].name, "Geirec");

// ── GPX ──
const gpx = toGpx({ name: "La nature & co", points: [[48.1, -1.6], [48.2, -1.5]], elevation: [50, 60], pois: inForest.pois, time: now });
assert.match(gpx, /<trkpt lat="48\.100000" lon="-1\.600000"><ele>50<\/ele><\/trkpt>/);
assert.match(gpx, /<wpt lat="48\.102500" lon="-1\.595000">\n    <name>Belvédère<\/name>/);
assert.match(gpx, /<name>La nature &amp; co<\/name>/);
assert.ok(gpx.indexOf("<wpt") < gpx.indexOf("<trk>"), "waypoints avant la trace (ordre du schéma GPX)");
assert.equal(gpxFileName("L'équilibrée", 12.44), "pulse-l-equilibree-12-4-km.gpx");

// Activités douces : vélotafs et marches, jamais une course (même détectée par Google Fit)
assert.equal(isSoftActivity({ type: "RUN", source: "google-fit", dedupeKey: "gfit-seg-8-1", title: "Running" }), false, "une course Google Fit n'est pas douce");
assert.equal(isSoftActivity({ type: "RUN", title: "Footing vélotaf" }), false);
assert.equal(isSoftActivity({ type: "WALK" }), true);
assert.equal(isSoftActivity({ type: "EBIKE" }), true);
assert.equal(isSoftActivity({ type: "RIDE", source: "google-fit" }), true, "vélo Google Fit non reclassé");
assert.equal(isSoftActivity({ type: "RIDE", source: "strava", title: "Sortie" }), false);

console.log("✓ itinéraires : estimation, OSM, notation, choix, lieux et GPX");
