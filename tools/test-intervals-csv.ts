// Export CSV Intervals.icu (lib/sync/intervals-runs.ts) : champs entre guillemets, virgules et guillemets doublés, CRLF.
import assert from "node:assert/strict";
import { activitiesFromCsv, parseCsv } from "@/lib/sync/intervals-runs";

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
console.log("export CSV Intervals : ok");
