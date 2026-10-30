// Export CSV Intervals.icu (lib/sync/intervals-runs.ts) : champs entre guillemets, virgules et guillemets doublés, CRLF.
import assert from "node:assert/strict";
import { activitiesFromCsv, bestDistanceIn, parseCsv, pointsFromStreams, type IntervalsStream } from "@/lib/sync/intervals-runs";

assert.deepEqual(parseCsv('a,"b, c","d ""e"""\r\n1,,3\n'), [["a", "b, c", 'd "e"'], ["1", "", "3"]]);

const csv = 'id,start_date_local,name,type,moving_time,distance,average_heartrate,start_date,file_type\r\n'
  + '16300001,2026-10-29T12:38:53,"Footing, midi ""cool""",Run,2301,6942.6,148.2,2026-10-29T11:38:53Z,\r\n'
  + 'i999,2026-10-28T18:00:00,MyWhoosh,VirtualRide,3600,30000,,2026-10-28T17:00:00Z,fit\r\n';
const [run, ride] = activitiesFromCsv(csv);
assert.equal(run.id, "16300001");
assert.equal(run.type, "Run");
assert.equal(run.name, 'Footing, midi "cool"');
assert.equal(run.distance, 6942.6);
assert.equal(run.moving_time, 2301);
assert.equal(run.average_heartrate, 148.2);
assert.equal(run.file_type, null);
assert.equal(ride.file_type, "fit");
assert.equal(ride.average_heartrate, null);
assert.throws(() => activitiesFromCsv("foo,bar\n1,2\n"));

// Commentaire Strava (colonne description), sur plusieurs lignes.
const [withNote] = activitiesFromCsv('id,type,description\n42,Run,"6\' à fond,\npuis retour au calme"\n');
assert.equal(withNote.description, "6' à fond,\npuis retour au calme");

// Courbes → points datés : latlng en data/data2, (0,0) écarté, cardio seulement s'il est là.
const streams: IntervalsStream[] = [
  { type: "time", data: [0, 1, 2] },
  { type: "latlng", data: [48.1, 0, 48.1002], data2: [-1.63, 0, -1.6302] },
  { type: "altitude", data: [50, 51, null] },
  { type: "heartrate", data: [0, 140, 150] },
];
const pts = pointsFromStreams(streams, 1_000_000);
assert.deepEqual(pts.map((p) => p.t), [1_000_000, 1_001_000, 1_002_000]);
assert.equal(pts[0].lat, 48.1);
assert.equal(pts[1].lat, undefined);
assert.equal(pts[0].hr, undefined);
assert.equal(pts[2].hr, 150);
assert.equal(pts[2].ele, undefined);

// Demi-Cooper : meilleure distance sur 6 min. 10 min de trot à 3 m/s, puis 6 min à 4 m/s, puis 3 min de trot.
const time: number[] = [], dist: number[] = [];
let d = 0;
for (let t = 0; t <= 19 * 60; t++) { time.push(t); dist.push(d); d += t >= 600 && t < 960 ? 4 : 3; }
assert.equal(bestDistanceIn([{ type: "time", data: time }, { type: "distance", data: dist }], 360), 1440);
assert.equal(bestDistanceIn([{ type: "time", data: [0, 100] }, { type: "distance", data: [0, 300] }], 360), null, "sortie plus courte que 6 min");
console.log("export CSV Intervals : ok");
