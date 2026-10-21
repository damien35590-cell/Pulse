// Lancer avec : npx tsx tools/test-intervals-workout.ts
import assert from "node:assert/strict";
import { externalId, fmtDuration, fmtTime, intervalsDescription, sessionIdOf, structureToIntervals, toIntervalsEvent } from "../lib/training/intervals-workout";
import type { RunWorkoutStructure } from "../types/training";

// ── Durées : « m » = minutes, « mtr » = mètres ──
assert.equal(fmtTime(1200), "20m");
assert.equal(fmtTime(75), "1m15");
assert.equal(fmtTime(90), "1m30");
assert.equal(fmtTime(45), "45s");
assert.equal(fmtTime(605), "10m05");
assert.equal(fmtDuration({ type: "distance", m: 400 }), "400mtr");
assert.equal(fmtDuration({ type: "distance", m: 2000 }), "2km");
assert.equal(fmtDuration({ type: "distance", m: 1500 }), "1.5km");
assert.equal(fmtDuration({ type: "lap" }), null);

// ── 20′ EF, 8 × 400 m, récup 1′15, 10′ RAC (VMA 15 km/h : 100 % = 4:00/km) ──
const vma = 15;
const frac: RunWorkoutStructure = { version: 1, steps: [
  { kind: "step", role: "warmup", duration: { type: "time", s: 1200 }, target: { ref: "VMA", pctMin: 65, pctMax: 75 } },
  { kind: "repeat", times: 8, steps: [
    { kind: "step", role: "active", duration: { type: "distance", m: 400 }, target: { ref: "VMA", pctMin: 98, pctMax: 98 } },
    { kind: "step", role: "recovery", duration: { type: "time", s: 75 }, target: { ref: "VMA", pctMin: 50, pctMax: 60 } },
  ] },
  { kind: "step", role: "cooldown", duration: { type: "time", s: 600 }, target: { ref: "VMA", pctMin: 60, pctMax: 70 } },
] };
// 98 % de 15 km/h = 14,7 km/h → 244,9 s/km → 4:05 ; 65–75 % → 5:20–6:09 ; 50–60 % → 6:40–8:00 ; 60–70 % → 5:43–6:40
const fracText = structureToIntervals(frac, vma)!;
assert.equal(fracText, [
  "Warmup",
  "- Échauffement 20m 5:20/km-6:09/km Pace",
  "",
  "8x",
  "- Effort 400mtr 4:05/km Pace",
  "- Récup 1m15 6:40/km-8:00/km Pace",
  "",
  "Cooldown",
  "- Retour au calme 10m 5:43/km-6:40/km Pace",
].join("\n"));

// Aucune distance écrite avec un « m » seul (lu comme des minutes par Intervals).
assert.ok(!/\b400m\b/.test(fracText));

// ── Séance simple : un seul pas, pas d'en-tête ──
const ef: RunWorkoutStructure = { version: 1, steps: [{ kind: "step", role: "active", duration: { type: "time", s: 2400 }, target: { ref: "VMA", pctMin: 65, pctMax: 75 }, label: "EF" }] };
assert.equal(structureToIntervals(ef, vma), "- EF 40m 5:20/km-6:09/km Pace");

// ── Zone cardio, allure absolue, une seule répétition ──
const mixed: RunWorkoutStructure = { version: 1, steps: [
  { kind: "step", role: "warmup", duration: { type: "time", s: 600 }, target: { ref: "HR_ZONE", zone: 2 } },
  { kind: "repeat", times: 1, steps: [{ kind: "step", role: "active", duration: { type: "time", s: 300 }, target: { ref: "PACE", sPerKmMin: 270, sPerKmMax: 270 } }] },
] };
assert.equal(structureToIntervals(mixed, vma), "Warmup\n- Échauffement 10m Z2 HR\n\n- Effort 5m 4:30/km Pace");

// ── Cible sans équivalent absolu (ressenti, allure objectif) : durée seule ──
const rpe: RunWorkoutStructure = { version: 1, steps: [{ kind: "step", role: "active", duration: { type: "time", s: 360 }, target: { ref: "RPE", value: 9 }, label: "à fond" }] };
assert.equal(structureToIntervals(rpe, vma), "- à fond 6m");

// Un libellé avec chiffres n'est jamais recopié (il serait lu comme une durée).
const odd: RunWorkoutStructure = { version: 1, steps: [{ kind: "step", role: "active", duration: { type: "time", s: 300 }, label: "10m fort" }] };
assert.equal(structureToIntervals(odd, vma), "- Effort 5m");

// ── Inexprimable → null, puis texte brut ──
const lap: RunWorkoutStructure = { version: 1, steps: [{ kind: "step", role: "active", duration: { type: "lap" } }] };
assert.equal(structureToIntervals(lap, vma), null);
const nested: RunWorkoutStructure = { version: 1, steps: [{ kind: "repeat", times: 2, steps: [{ kind: "repeat", times: 2, steps: [{ kind: "step", role: "active", duration: { type: "time", s: 30 } }] }] }] };
assert.equal(structureToIntervals(nested, vma), null);
assert.equal(structureToIntervals({ version: 1, steps: [] }, vma), null);
assert.equal(structureToIntervals(ef, 0), null);

assert.deepEqual(intervalsDescription({ title: "Sortie libre", description: "Comme tu le sens", structure: null }, vma), { text: "Comme tu le sens", structured: false });
assert.deepEqual(intervalsDescription({ title: "Sortie libre", description: null, structure: null }, vma), { text: "Sortie libre", structured: false });
assert.equal(intervalsDescription({ title: "Tours", description: null, structure: lap }, vma).structured, false);
assert.equal(intervalsDescription({ title: "Fractionné", description: null, structure: frac }, vma).structured, true);

// ── Événement envoyé à Intervals ──
const ev = toIntervalsEvent({ id: "abc123", date: "2026-10-23", title: "Fractionné 8 × 400 m", description: null, structure: frac, plannedDurationS: null }, vma);
assert.equal(ev.category, "WORKOUT");
assert.equal(ev.type, "Run");
assert.equal(ev.start_date_local, "2026-10-23T00:00:00");
assert.equal(ev.external_id, "pulse-abc123");
assert.equal(ev.name, "Fractionné 8 × 400 m");
// 1200 + 8 × (400 m à 14,7 km/h ≈ 98 s + 75 s) + 600 ≈ 3184 s
assert.ok(Math.abs(ev.moving_time! - 3184) <= 2, `moving_time ${ev.moving_time}`);
assert.equal(ev.description, fracText);
// Sans structure : durée prévue en base, sinon pas de moving_time.
assert.equal(toIntervalsEvent({ id: "x", date: "2026-10-23", title: "T", description: null, structure: null, plannedDurationS: 1800 }, vma).moving_time, 1800);
assert.ok(!("moving_time" in toIntervalsEvent({ id: "x", date: "2026-10-23", title: "T", description: null, structure: null, plannedDurationS: null }, vma)));

// ── external_id stable et réversible ──
assert.equal(externalId("abc"), "pulse-abc");
assert.equal(sessionIdOf("pulse-abc"), "abc");
assert.equal(sessionIdOf("garmin-1"), null);
assert.equal(sessionIdOf(null), null);

console.log("test-intervals-workout : ok");
