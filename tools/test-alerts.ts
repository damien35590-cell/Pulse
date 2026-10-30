// Lancer avec : npx tsx tools/test-alerts.ts
// Alertes de synchro Strava : limite d'une notification par type et par 3 jours.
import assert from "node:assert/strict";
import { alertDue, isCookieError, staleStreamCount, streamsAlertBody } from "../lib/notify/alerts";

const now = Date.parse("2026-10-30T12:00:00Z"), day = 864e5;
assert.equal(alertDue(null, now), true);
assert.equal(alertDue(undefined, now), true);
assert.equal(alertDue(new Date(now - 2 * day), now), false);
assert.equal(alertDue(new Date(now - 3 * day + 1), now), false);
assert.equal(alertDue(new Date(now - 3 * day), now), true);

assert.equal(isCookieError(new Error("Intervals.icu refuse l'accès (401) : cookie « i » expiré")), true);
assert.equal(isCookieError(new Error("Intervals.icu refuse l'accès (403) : ...")), true);
assert.equal(isCookieError(new Error("Intervals.icu a répondu 500")), false);

const iso = (d: number) => new Date(now - d).toISOString();
assert.equal(staleStreamCount([{ startedAt: iso(1 * day) }, { startedAt: iso(3 * day + 1) }, { startedAt: iso(5 * day) }], now), 2);
assert.equal(staleStreamCount([], now), 0);
assert.equal(streamsAlertBody(2), "2 sortie(s) attendent leur carte : ouvre intervals.icu");
console.log("alertes : ok");
