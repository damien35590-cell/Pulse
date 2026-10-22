// Lancer avec : npx tsx tools/test-strength.ts
import assert from "node:assert/strict";
import { buildStrengthAnalysis, type StrengthRow } from "../lib/analytics/strength";

const tz = "Europe/Paris", now = new Date("2026-10-21T08:00:00Z"); // mercredi
const d = (iso: string) => new Date(iso + "T08:00:00Z");
const set = (reps: number, loadKg: number | null = null) => ({ reps, loadKg, done: true });
const row = (activityId: string, day: string, name: string, sets: number, reps: number, done: number[], loadKg: number | null = null): StrengthRow =>
  ({ activityId, startedAt: d(day), name, sets, reps, loadKg, setsDetail: done.map((r) => set(r, loadKg)) });

// Vide
assert.equal(buildStrengthAnalysis([], 4, tz, now).empty, true);

// B2 raté deux fois d'affilée (cible 6×10, 6 séries à 8) → blocage 2, variante plus facile B1
const rows = [
  row("a1", "2026-10-05", "C1 - tractions", 6, 8, [8, 8, 8, 8, 8, 8]),
  row("a2", "2026-10-12", "B2 - dips", 6, 10, [10, 10, 10, 10, 10, 10]),
  row("a3", "2026-10-15", "B2 - dips", 6, 10, [9, 9, 8, 8, 7, 7]),
  row("a4", "2026-10-19", "B2 - dips", 6, 10, [9, 9, 8, 8, 7, 7]),
  row("a4", "2026-10-19", "Squat", 3, 5, [5, 5, 5], 80),
];
const r = buildStrengthAnalysis(rows, 4, tz, now);
assert.equal(r.summary.sessions, 4);
assert.equal(r.summary.tonnage, 5 * 80 * 3, "tonnage : seules les séries chargées comptent");
const b = r.exercises.find((e) => e.key === "lafay:b")!;
assert.equal(b.status, "stall2");
assert.equal(b.variant, "B2");
assert.equal(b.level, "6×10");
assert.equal(b.easierVariant, "B1");
assert.equal(b.sessions, 3);
assert.equal(r.exercises[0].lastDay, "2026-10-19", "tri par dernière séance");
assert.ok(r.insights.some((t) => t.includes("bloqué depuis 2 séances") && t.includes("B1")), r.insights.join(" | "));
assert.ok(r.insights.some((t) => t.startsWith("Meilleure série : 5 × 80 kg sur Squat")), r.insights.join(" | "));

// Sans aucune charge : pas de tonnage
assert.equal(buildStrengthAnalysis(rows.slice(0, 3), 4, tz, now).summary.tonnage, null);
// Semaines vides gardées à 0
assert.equal(r.weekly.length, 4);
console.log("test-strength : ok");
