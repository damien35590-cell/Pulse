// Lancer avec : npx tsx tools/check-training.ts
import assert from "node:assert/strict";
import { fmtPaceS, paceSPerKm, summarizeRun, estimateRun, resolveSteps } from "../lib/training/resolve";
import { generateRunBaseVma, startMonday } from "../lib/training/generate";
import { pickVma, vmaFromHalfCooper, vmaFromRace } from "../lib/training/vma";

// ── Allures ──
assert.equal(fmtPaceS(paceSPerKm(15, 100)), "4:00");
assert.equal(fmtPaceS(paceSPerKm(15, 90)), "4:27");
assert.equal(fmtPaceS(paceSPerKm(14.5, 100)), "4:08");

// ── VMA ──
assert.equal(vmaFromHalfCooper(1450), 14.5);
assert.equal(vmaFromRace(10000, 44 * 60, 365), 14.5); // 44′ sur 10 km il y a un an
assert.equal(vmaFromRace(10000, 40 * 60), 16.5);       // 10 km ≈ 90 % de la VMA : 15 / 0,9 = 16,7 → 16,5
const old = new Date("2026-01-01"), recent = new Date("2026-09-01");
assert.equal(pickVma([{ value: 14, measuredAt: old, source: "ESTIMATED" }, { value: 15.2, measuredAt: recent, source: "TEST" }])?.vmaKmh, 15.2);
assert.equal(pickVma([], { distanceM: 10000, timeS: 2640, date: new Date("2025-10-17") }, new Date("2026-10-17"))?.vmaKmh, 14.5);
assert.equal(pickVma([]), null);

// ── Date de départ ──
assert.equal(startMonday("2026-10-14"), "2026-10-12"); // mercredi → ce lundi
assert.equal(startMonday("2026-10-17"), "2026-10-19"); // samedi → lundi suivant

// ── Génération ──
for (const n of [2, 3] as const) {
  const g = generateRunBaseVma({ sessionsPerWeek: n, vmaKmh: 15, startDate: "2026-10-19" });
  assert.equal(g.weeks.length, 12, `${n} séances : 12 semaines`);
  assert.equal(g.phases.map((p) => p.type).join(","), "BASE,BUILD,BUILD");
  assert.equal(g.program.endDate, "2027-01-10");
  for (const w of g.weeks) {
    assert.equal(w.sessions.length, n, `semaine ${w.number} : ${n} séances`);
    assert.equal(w.phaseOrder, Math.ceil(w.number / 4));
    assert.deepEqual(w.sessions.map((s) => s.orderInWeek), n === 3 ? [1, 2, 3] : [1, 2]);
    assert.equal(w.sessions.at(-1)!.kind, "LONG_RUN");
  }
  // Semaines 4, 8, 12 allégées : pas de séance dure, volume ≈ × 0,7 de la semaine 3 du bloc
  const recovery = g.weeks.filter((w) => w.isRecovery).map((w) => w.number);
  assert.deepEqual(recovery, [4, 8, 12]);
  for (const r of recovery) {
    const w = g.weeks[r - 1], prev = g.weeks[r - 2];
    assert.ok(w.sessions.every((s) => !s.isKeySession && (s.kind === "EASY" || s.kind === "LONG_RUN")), `semaine ${r} sans séance dure`);
    const ratio = w.targetDistanceM / prev.targetDistanceM;
    assert.ok(ratio < 0.85, `semaine ${r} allégée (${Math.round(ratio * 100)} % de la précédente)`);
  }
  // Semaine 1 = test VMA ; ensuite VMA courte et seuil en alternance
  assert.equal(g.weeks[0].sessions[0].kind, "VMA_TEST");
  assert.deepEqual(
    [2, 3, 5, 6, 7, 9, 10, 11].map((k) => g.weeks[k - 1].sessions[0].title),
    ["VMA courte · 8 × 30/30", "Seuil · 3 × 6′", "VMA courte · 10 × 30/30", "Seuil · 3 × 8′", "VMA courte · 8 × 400 m", "Seuil · 2 × 12′", "VMA courte · 10 × 400 m", "Seuil · 2 × 15′"],
  );
  // Sortie longue de 45′ à 65′
  const longs = g.weeks.filter((w) => !w.isRecovery).map((w) => w.sessions.at(-1)!.plannedDurationS / 60);
  assert.equal(longs[0], 45); assert.equal(Math.max(...longs), 65);
  if (n === 3) {
    const easies = g.weeks.filter((w) => !w.isRecovery).map((w) => w.sessions[1].plannedDurationS / 60);
    assert.ok(easies.every((m) => m >= 35 && m <= 45), "footing 35–45′");
  }
}

// ── Résumés ──
const g3 = generateRunBaseVma({ sessionsPerWeek: 3, vmaKmh: 15, startDate: "2026-10-19" });
const s400 = g3.weeks[9].sessions[0];
console.log("S10 :", summarizeRun(s400.structure, 15));
assert.equal(summarizeRun(s400.structure, 15), "20′ EF · 10 × 400 m à 4:06 /km (r 1′15) · 10′ RAC");
assert.equal(summarizeRun(g3.weeks[0].sessions[0].structure, 15), "15′ EF · 6′ à fond (≈ 4:00 /km) · 10′ RAC");
assert.equal(summarizeRun(g3.weeks[2].sessions[0].structure, 15), "20′ EF · 3 × 6′ à 4:37 /km (r 2′) · 10′ RAC");
assert.equal(summarizeRun(g3.weeks[1].sessions[0].structure, 15), "20′ EF · 8 × 30″ à 3:54 /km (r 30″) · 10′ RAC");
console.log("Footing :", summarizeRun(g3.weeks[0].sessions[1].structure, 15));
assert.equal(resolveSteps(s400.structure, 15).length, 22); // échauffement + 10 × (400 m + récup) + retour au calme
const est = estimateRun(s400.structure, 15);
console.log("S10 durée estimée :", Math.round(est.durationS / 60), "min,", (est.distanceM / 1000).toFixed(1), "km");

// Récapitulatif lisible
for (const w of g3.weeks) console.log(`S${String(w.number).padStart(2)}${w.isRecovery ? " (allégée)" : "          "} ${(w.targetDistanceM / 1000).toFixed(1).padStart(5)} km  ${w.sessions.map((s) => s.title).join(" | ")}`);
console.log("✓ check-training : tout est bon");
