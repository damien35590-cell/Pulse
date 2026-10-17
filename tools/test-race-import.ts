// Lancer avec : npx tsx tools/test-race-import.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { importNextRun } from "../lib/races/import/nextrun";
import { importRaceFromUrl } from "../lib/races/import";

const html = readFileSync(new URL("../lib/races/import/__fixtures__/nextrun-dinard.html", import.meta.url), "utf8");
// Le test ne touche pas au réseau : fetch renvoie la fixture.
const klikegoHtml = readFileSync(new URL("../lib/races/import/__fixtures__/klikego-neveztell.html", import.meta.url), "utf8");
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any) => new Response(String(input.href ?? input).includes("klikego") ? klikegoHtml : html, { status: 200 })) as typeof fetch;

(async () => {
  const all = await importNextRun("https://nextrun.fr/events/dinard-off-course");
  assert.equal(all.event.eventName, "Dinard Off Course 2027");
  assert.equal(all.races.length, 4, "4 épreuves");
  const grande = all.races.find((r) => r.name === "La Grande Boucle")!;
  assert.ok(grande, "La Grande Boucle trouvée");
  assert.equal(grande.date, "2027-03-27");
  assert.equal(grande.startTime, "15:00");
  assert.equal(grande.targetDistance, 14); // km : RaceEvent stocke targetDistance en km
  assert.equal(grande.priceCents, 1800);
  assert.match(grande.location ?? "", /Dinard/);
  assert.equal(grande.platform, "NEXTRUN");
  assert.equal(grande.sport, "RUN");
  assert.equal(grande.targetElevation, undefined);
  assert.equal(grande.eventName, "Dinard Off Course 2027");
  assert.ok(grande.url.startsWith("https://nextrun.fr/events/dinard-off-course/races/"));

  const petite = all.races.find((r) => r.name === "La Petite Boucle - Course ou Marche")!;
  assert.ok(petite, "La Petite Boucle trouvée");
  assert.equal(petite.targetDistance, 4.5);
  assert.equal(petite.priceCents, 1000);
  assert.equal(petite.sport, "HIKE");

  const one = await importNextRun("https://nextrun.fr/events/dinard-off-course/races/01a11aee-19ef-70d2-b59b-d6b266a3a195");
  assert.equal(one.races.length, 1);
  assert.equal(one.races[0].name, "La Grande Boucle");
  assert.equal(one.event.date, "2027-03-27");

  // ── Klikego ──
  const kUrl = "https://www.klikego.com/inscription/neveztell-trail-2026/course-a-pied-running/1350372166564-11";
  const k = await importRaceFromUrl(`${kUrl}?utm_source=mail&utm_medium=x`);
  assert.equal(k.races.length, 10, "10 épreuves Klikego");
  assert.equal(k.event.eventName, "NEVEZTELL TRAIL 2026");
  assert.equal(new Set(k.races.map((r) => r.url)).size, 10, "urls uniques");
  assert.ok(k.races.every((r) => r.url.startsWith(`${kUrl}#`) && !r.url.includes("utm_")), "url sans utm + ancre");
  assert.ok(k.races.every((r) => r.platform === "KLIKEGO" && r.needsDateCheck === true));
  const noct = k.races.find((r) => r.name === "Neveztell Nocturne 13 km")!;
  assert.equal(noct.targetDistance, 13);
  assert.equal(noct.priceCents, 1400);
  assert.match(noct.location ?? "", /Nouvoitou/);
  assert.equal(noct.date, "2026-10-17");
  assert.equal(noct.startTime, "19:30");
  const nature = k.races.find((r) => r.name === "Neveztell Nature 15 km")!;
  assert.equal(nature.targetDistance, 15);
  assert.equal(nature.startTime, "09:30");
  assert.equal(nature.targetElevation, 250);
  assert.equal(nature.date, "2026-10-18", "le dimanche, malgré le startDate faux du JSON-LD");
  assert.equal(k.races.find((r) => r.name === "Neveztell Découverte 10 km")!.priceCents, 1200);
  assert.equal(k.races.find((r) => /Défi #1/.test(r.name!))!.targetDistance, 28);
  assert.ok(k.races.slice(-4).every((r) => /Mini-Trail/.test(r.name!)), "épreuves enfants en bas de liste");
  assert.equal(new Set(k.races.map((r) => r.eventName)).size, 1);

  console.log("OK : tous les tests d'import NextRun et Klikego passent");
  console.log(k.races.map((r) => `${r.name} | ${r.date} ${r.startTime} | ${r.targetDistance} km | D+ ${r.targetElevation} | ${r.priceCents} cts`).join("\n"));
  console.log(all.races.map((r) => `${r.name} | ${r.date} ${r.startTime} | ${r.targetDistance} km | ${r.priceCents} cts | ${r.sport} | ${r.location} | ${r.requiredDocument}`).join("\n"));
})().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { globalThis.fetch = realFetch; });
