// Lancer avec : npx tsx tools/test-overview.ts
import assert from "node:assert/strict";
import { buildOverview, type OverviewAct } from "../lib/analytics/overview";

const tz = "Europe/Paris", now = new Date("2026-10-21T08:00:00Z"); // mercredi
const act = (type: string, day: string, min: number, o: Partial<OverviewAct> = {}): OverviewAct => ({
  type, title: "Séance", source: "fit", dedupeKey: null, startedAt: new Date(day + "T08:00:00Z"), distanceM: 0, movingTimeS: min * 60, load: 50, ...o,
});
const base = { insights: {}, weeks: 4, tz, now };

// Vide, et une période où il n'y a que des activités douces
assert.equal(buildOverview({ ...base, acts: [] }).empty, true);
assert.equal(buildOverview({ ...base, acts: [act("EBIKE", "2026-10-20", 20), act("WALK", "2026-10-19", 30)] }).empty, true, "vélotaf et marche ne sont pas de l'entraînement");

const acts = [
  act("WORKOUT", "2026-10-06", 45), act("WORKOUT", "2026-10-13", 45), act("WORKOUT", "2026-10-20", 45),
  act("RUN", "2026-10-07", 60, { distanceM: 10000 }), act("RUN", "2026-10-14", 30, { distanceM: 5000 }),
  act("RIDE", "2026-10-15", 90, { source: "mywhoosh" }),
  act("EBIKE", "2026-10-20", 25, { title: "Vélotaf" }), act("RIDE", "2026-10-16", 20, { source: "google-fit" }),
];
const r = buildOverview({ ...base, acts });
assert.equal(r.summary.sessions, 6, "les 2 vélotafs sont exclus");
assert.equal(r.summary.timeS, (45 * 3 + 60 + 30 + 90) * 60);
assert.equal(r.summary.load, 300);
assert.equal(r.summary.activeDays, 6);
assert.equal(r.footer.softCount, 2);
assert.equal(r.footer.softTimeS, 45 * 60);

// Charge masquée quand aucune activité n'en a une d'enregistrée
assert.equal(buildOverview({ ...base, acts: acts.map((a) => ({ ...a, load: null })) }).summary.load, null);

// Heures par sport et par semaine : semaine du 12 octobre = 45 min de muscu + 30 min de course + 90 min de vélo
const w = r.weekly.find((x) => x.weekStart === "2026-10-12")!;
assert.equal(w.hours.WORKOUT, 0.75);
assert.equal(w.hours.RUN, 0.5);
assert.equal(w.hours.RIDE, 1.5);
assert.equal(r.weekly.length, 4);

// Répartition : triée par temps, parts en % du temps et des séances
assert.equal(r.split[0].group, "WORKOUT");
assert.equal(r.split.reduce((s, x) => s + x.sessions, 0), 6);
assert.equal(r.split.find((x) => x.group === "RIDE")!.sessionsPct, 17);

// Forme : fitness, fatigue, fraîcheur
assert.ok(r.form && r.form.series.length === 84 && r.form.ctl > 0 && r.form.atl > r.form.ctl);

// Régularité : 3 semaines actives d'affilée, semaine en cours comprise
assert.equal(r.regularity.activeStreak, 3, "semaines du 5, du 12 et du 19 octobre ; la semaine du 28 septembre est vide");
assert.equal(buildOverview({ ...base, acts: acts.filter((a) => +a.startedAt < +new Date("2026-10-19T00:00:00Z")) }).regularity.activeStreak, 2, "la semaine en cours vide ne casse pas la série");

// À retenir : une phrase par sport au plus (les générateurs des onglets dédiés), 3 au maximum
const ins = buildOverview({ ...base, acts, insights: { WORKOUT: ["Phrase muscu.", "Autre"], RIDE: ["Phrase vélo."], HIKE: ["Phrase rando."] } }).insights;
assert.deepEqual(ins.slice(0, 2), ["Phrase muscu.", ins[1]]);
assert.ok(ins.length <= 3);
assert.ok(ins.includes("Phrase vélo.") && !ins.includes("Autre"));
assert.ok(ins.some((t) => t.startsWith("Plus longue sortie running : 10 km")), ins.join(" | "));
console.log("test-overview : ok");
