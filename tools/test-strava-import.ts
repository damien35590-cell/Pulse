// Lancer avec : npx tsx tools/test-strava-import.ts
import assert from "node:assert/strict";
import { findDuplicate, mapStravaType, parseCsv, parseNumber, parseStravaDate, readStravaCsv, stravaKey, toParsed, type KnownActivity } from "../lib/import/strava";
import { parseXmlTrack } from "../lib/import/xml-track";

// ── CSV : guillemets, retours à la ligne dans une description, en-têtes répétés (le dernier « Distance » est en mètres) ──
const csv = [
  `ID de l'activité,Date de l'activité,Nom de l'activité,Type d'activité,Description de l'activité,Temps écoulé,Distance,Nom du fichier,Déplacement-transport,Temps écoulé,Durée de déplacement,Distance,Dénivelé positif`,
  `1,"20 oct. 2026, 10:36:04",Midi,Course à pied,"8x2'",2559,"6,71",activities/1.gpx,false,2559.0,2496.0,6718.4,36.6`,
  `2,"4 août 2023, 06:35:09","St Malo, Erquy",Vélo,"ligne 1\n""ligne 2""",43331,"100,53",,true,43331.0,23814.0,100532.0,1017.9`,
].join("\r\n");
assert.deepEqual(parseCsv(`a,"b,1"\n"c""d",e\n`), [["a", "b,1"], ['c"d', "e"]]);
const { rows, missing } = readStravaCsv(csv);
assert.deepEqual(missing, []);
assert.equal(rows.length, 2);
assert.equal(rows[0].distanceM, 6718.4);
assert.equal(rows[0].movingS, 2496);
assert.equal(rows[0].description, "8x2'");
assert.equal(rows[1].name, "St Malo, Erquy");
assert.equal(rows[1].description, 'ligne 1\n"ligne 2"');
assert.equal(rows[1].file, null);
assert.equal(rows[1].commute, true);
assert.deepEqual(readStravaCsv("a,b\n1,2").missing, ["id", "date", "type"]);

// ── Dates (UTC) et nombres ──
assert.equal(parseStravaDate("20 oct. 2026, 10:36:04")?.toISOString(), "2026-10-20T10:36:04.000Z");
assert.equal(parseStravaDate("4 août 2023, 06:35:09")?.toISOString(), "2023-08-04T06:35:09.000Z");
assert.equal(parseStravaDate("17 déc. 2025, 19:37:41")?.toISOString(), "2025-12-17T19:37:41.000Z");
assert.equal(parseStravaDate("5 févr. 2022, 7:05:00")?.toISOString(), "2022-02-05T07:05:00.000Z");
assert.equal(parseStravaDate("Oct 20, 2026, 10:36:04 PM")?.toISOString(), "2026-10-20T22:36:04.000Z");
assert.equal(parseStravaDate("Oct 20, 2026, 12:05:00 AM")?.toISOString(), "2026-10-20T00:05:00.000Z");
assert.equal(parseStravaDate("n'importe quoi"), null);
assert.equal(parseNumber("6,71"), 6.71);
assert.equal(parseNumber(""), undefined);

// ── Types : vélotaf et marche = activités douces ; inconnu = OTHER signalé, jamais ignoré ──
assert.deepEqual(mapStravaType("Course à pied"), { kind: "RUN", known: true, commute: false });
assert.equal(mapStravaType("Vélo virtuel").kind, "RIDE");
assert.equal(mapStravaType("Vélo électrique").kind, "EBIKE");
assert.deepEqual(mapStravaType("Vélo", true), { kind: "EBIKE", known: true, commute: true });
assert.equal(mapStravaType("Vélo", false).kind, "RIDE");
assert.equal(mapStravaType("Randonnée").kind, "HIKE");
assert.equal(mapStravaType("Marche").kind, "WALK");
assert.equal(mapStravaType("Musculation").kind, "WORKOUT");
assert.deepEqual(mapStravaType("Escalade"), { kind: "OTHER", known: false, commute: false });

// ── Activité sans fichier : CSV seul ──
const manual = toParsed(rows[1], null);
assert.equal(manual.dedupeKey, stravaKey("2"));
assert.equal(manual.externalId, "2");
assert.equal(manual.source, "strava");
assert.equal(manual.type, "EBIKE");
assert.equal(manual.movingTimeS, 23814);
assert.equal(manual.elapsedTimeS, 43331);
assert.equal(manual.distanceM, 100532);
assert.equal(manual.startedAt, "2023-08-04T06:35:09.000Z");
assert.deepEqual(manual.points, []);
assert.throws(() => toParsed({ ...rows[1], startedAt: null }, null), /date illisible/);

// ── GPX / TCX côté Node : FC, cadence, puissance, altitude ──
const gpx = `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk><name>Boucle</name><type>running</type><trkseg>
<trkpt lat="48.1" lon="-1.6"><ele>50</ele><time>2026-10-20T10:00:00Z</time><extensions><power>200</power><gpxtpx:TrackPointExtension><gpxtpx:hr>140</gpxtpx:hr><gpxtpx:cad>80</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>
<trkpt lat="48.101" lon="-1.6"><ele>55</ele><time>2026-10-20T10:01:00Z</time><extensions><power>220</power><gpxtpx:TrackPointExtension><gpxtpx:hr>150</gpxtpx:hr><gpxtpx:cad>82</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions></trkpt>
</trkseg></trk></gpx>`;
const g = parseXmlTrack(gpx, "boucle.gpx", "gpx");
assert.equal(g.type, "RUN");
assert.equal(g.title, "Boucle");
assert.equal(g.startedAt, "2026-10-20T10:00:00.000Z");
assert.deepEqual(g.points.map((p) => [p.hr, p.cad, p.power, p.ele]), [[140, 80, 200, 50], [150, 82, 220, 55]]);
assert.equal(g.avgHr, 145);
assert.equal(g.avgPower, 210);
assert.ok(g.distanceM > 100 && g.distanceM < 120);
const withFile = toParsed(rows[0], g);
assert.equal(withFile.type, "RUN");
assert.equal(withFile.distanceM, 6718.4); // durée, distance et dénivelé : valeurs de Strava
assert.equal(withFile.avgHr, 145);        // mesures : celles du fichier
assert.equal(withFile.points.length, 2);

const tcx = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Lap><Track>
<Trackpoint><Time>2026-10-20T10:00:00Z</Time><Position><LatitudeDegrees>48.1</LatitudeDegrees><LongitudeDegrees>-1.6</LongitudeDegrees></Position><AltitudeMeters>50</AltitudeMeters><HeartRateBpm><Value>120</Value></HeartRateBpm><Cadence>85</Cadence><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>180</Watts></TPX></Extensions></Trackpoint>
<Trackpoint><Time>2026-10-20T10:00:10Z</Time><Position><LatitudeDegrees>48.1005</LatitudeDegrees><LongitudeDegrees>-1.6</LongitudeDegrees></Position><AltitudeMeters>51</AltitudeMeters><HeartRateBpm><Value>124</Value></HeartRateBpm><Cadence>86</Cadence><Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2"><Watts>190</Watts></TPX></Extensions></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
const t = parseXmlTrack(tcx, "x.tcx", "tcx");
assert.equal(t.type, "RIDE");
assert.deepEqual(t.points.map((p) => [p.hr, p.cad, p.power]), [[120, 85, 180], [124, 86, 190]]);
assert.throws(() => parseXmlTrack("<html/>", "x.gpx", "gpx"), /illisible/);

// ── Doublons : même sport, début à ±5 min, durée proche ; ne dépend pas de la source ──
const at = (iso: string) => new Date(iso);
const ex = (o: Partial<KnownActivity>): KnownActivity => ({ id: "e", type: "RUN", title: "Run", startedAt: at("2026-10-20T10:36:00Z"), movingTimeS: 2500, elapsedTimeS: 2560, source: "fit", dedupeKey: "2026-10-20T10:36", ...o });
const cand = { type: "RUN", startedAt: at("2026-10-20T10:36:04Z"), movingTimeS: 2496, elapsedTimeS: 2559 };
assert.equal(findDuplicate(cand, [ex({})])?.reason, "debut+duree");
assert.equal(findDuplicate(cand, [ex({ startedAt: at("2026-10-20T10:40:30Z") })])?.reason, "debut+duree");
assert.equal(findDuplicate(cand, [ex({ startedAt: at("2026-10-20T10:42:00Z") })])?.reason, "chevauchement"); // >5 min mais recouvre
assert.equal(findDuplicate(cand, [ex({ startedAt: at("2026-10-20T12:00:00Z") })]), null);
assert.equal(findDuplicate(cand, [ex({ type: "RIDE" })]), null);                                          // autre sport
assert.equal(findDuplicate(cand, [ex({ movingTimeS: 900, elapsedTimeS: 900 })]), null);                  // même départ, court segment dans une longue sortie : pas un doublon
assert.equal(findDuplicate({ ...cand, type: "EBIKE" }, [ex({ type: "RIDE", source: "google-fit" })])?.existing.source, "google-fit"); // vélo / vélotaf
assert.equal(findDuplicate(cand, [ex({ id: "far", startedAt: at("2026-10-20T10:39:00Z") }), ex({ id: "near" })])?.existing.id, "near");

console.log("test-strava-import : ok");
