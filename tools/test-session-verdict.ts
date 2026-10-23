// Lancer avec : npx tsx tools/test-session-verdict.ts
import assert from "node:assert/strict";
import { computeDecoupling, computeVerdict, type SessionInput, type TrackSample } from "../lib/coach/session-verdict";
import { commentTemplate } from "../lib/coach/comment-templates";
import { resolveComment, validateComment } from "../lib/coach/comment-guard";
import type { StrengthRow } from "../lib/analytics/strength";

// ── Garde-fou ──
const ok = (t: string, k: Parameters<typeof validateComment>[1] = "validated") => assert.equal(validateComment(t, k).ok, true, t);
const ko = (t: string, k: Parameters<typeof validateComment>[1] = "validated") => assert.equal(validateComment(t, k).ok, false, t);
ok("Allure EF respectée (5:20-6:09). Bonne assimilation du bloc.");
ok("Arrêt à mi-parcours, stop du chrono.", "fatigue"); // « stop » ne contient pas « top » comme mot
ko("Séance validée 💪"); ko("Séance validée !"); ko("🏃");
for (const w of ["Super séance", "INCROYABLE", "Lâche rien", "lache rien", "Génial", "genial", "C'est top", "Excellent", "Parfait", "Chapeau", "Comme un chef", "Bien joué", "bien joue", "Continue comme ça", "Tu as tout donné", "Ne te décourage pas"]) ko(`${w}.`);
ko("Bravo."); ko("Félicitations.", "underperformance"); ko("felicitations", "fatigue");
ok("Bravo, record battu.", "record"); ok("Félicitations.", "record");
ko("Super record.", "record");

// resolveComment : une régénération, puis gabarit
async function guardFlow() {
  const calls: number[] = [];
  assert.equal(await resolveComment("validated", "GABARIT", async (n) => { calls.push(n); return "Super !"; }), "GABARIT");
  assert.deepEqual(calls, [0, 1], "un essai + une seule régénération");
  assert.equal(await resolveComment("validated", "GABARIT", async (n) => (n === 0 ? "Génial" : "Cible atteinte.")), "Cible atteinte.");
  assert.equal(await resolveComment("validated", "GABARIT"), "GABARIT");
  assert.equal(await resolveComment("validated", "GABARIT", async () => { throw new Error("réseau"); }), "GABARIT");
}

// ── Verdict ──
const base: SessionInput = { type: "RUN", startHour: 18, secondOfDay: false, distanceM: 8000, movingTimeS: 2800, avgHr: 150 }; // 5:50/km
const ef = { label: "EF", paceSKm: [320, 369] as [number, number], hr: [135, 160] as [number, number] };
const kindOf = (i: SessionInput) => computeVerdict(i)?.kind ?? null;

// validated
const val = computeVerdict({ ...base, plan: ef })!;
assert.equal(val.kind, "validated");
assert.equal(commentTemplate(val), "Allure EF respectée (5:20-6:09). Bonne assimilation du bloc, fréquence cardiaque maintenue dans la zone cible.");
assert.equal(kindOf({ ...base, plan: { ...ef, paceSKm: [300, 330] } }), null, "allure hors cible : pas de validation");
assert.equal(kindOf(base), null, "sans cible ni anomalie : rien à dire");

// fatigue : découplage, dérive de FC, ressenti
assert.equal(kindOf({ ...base, plan: ef, decouplingPct: 6.2 }), "fatigue");
assert.equal(kindOf({ ...base, plan: ef, decouplingPct: 4 }), "validated");
const recent = [150, 146, 144, 146, 145].map((hr) => ({ paceSKm: 350, avgHr: hr })); // médiane 146
const drift = computeVerdict({ ...base, avgHr: 151, plan: ef, recentRuns: recent })!;
assert.equal(drift.kind, "fatigue"); assert.equal(drift.facts.hrDriftBpm, 5);
assert.equal(commentTemplate({ kind: "fatigue", facts: { sport: "RUN", hrDriftBpm: 4 } }), "Dérive cardiaque observée (+4 BPM à allure constante). Signe de fatigue accumulée, privilégier la récupération sur les prochaines 48h.");
assert.equal(kindOf({ ...base, avgHr: 151, recentRuns: recent.map((r) => ({ ...r, paceSKm: 400 })) }), null, "allures non comparables (> 15 s/km)");
assert.equal(kindOf({ ...base, avgHr: 151, recentRuns: recent.slice(0, 2) }), null, "moins de 3 sorties comparables");
assert.equal(kindOf({ ...base, plan: ef, feeling: "HARD" }), "fatigue");
assert.equal(kindOf({ ...base, type: "RIDE", feeling: "TIRED" }), "fatigue");

// découplage calculé sur la trace : 2e moitié plus lente à FC égale
const trace = (hr2: number): TrackSample[] => Array.from({ length: 1801 }, (_, i) => ({ t: i * 1000, lat: 48 + (i < 900 ? i * 3e-5 : 900 * 3e-5 + (i - 900) * 2.7e-5), lng: -1.7, hr: i < 900 ? 140 : hr2 }));
assert.ok(computeDecoupling(trace(150))! > 5);
const dec = computeDecoupling(trace(140))!;
assert.ok(dec > 9 && dec < 11, `vitesse -10 % à FC égale = découplage ≈ 10 % (${dec})`);
assert.equal(computeDecoupling(trace(150).slice(0, 300)), null, "trace trop courte");

// record (course) : prioritaire sur la fatigue
const rec = computeVerdict({ ...base, plan: ef, feeling: "HARD", records: [{ label: "5 km", timeS: 1320 }, { label: "10 km", timeS: 2700 }] })!;
assert.equal(rec.kind, "record"); assert.equal(rec.facts.recordLabel, "10 km");
assert.equal(commentTemplate(rec), "Record personnel sur 10 km : 45:00. Félicitations, la progression est confirmée par les chiffres.");

// constrained : validée mais tard, ou 2e séance du jour
assert.equal(kindOf({ ...base, plan: ef, startHour: 21 }), "constrained");
assert.equal(kindOf({ ...base, plan: ef, startHour: 20 }), "validated");
assert.equal(kindOf({ ...base, plan: ef, secondOfDay: true }), "constrained");
assert.equal(kindOf({ ...base, plan: ef, startHour: 22, feeling: "HARD" }), "fatigue", "fatigue prime sur constrained");
assert.equal(commentTemplate({ kind: "constrained", facts: { sport: "RUN" } }), "Séance validée. La régularité du plan est maintenue malgré les contraintes.");

// exclusions : vélotaf, marche, E-bike, Google Fit
assert.equal(computeVerdict({ ...base, type: "RIDE", title: "Vélotaf", plan: ef, records: [{ label: "5 km", timeS: 1 }] }), null);
assert.equal(computeVerdict({ ...base, type: "WALK", plan: ef }), null);
assert.equal(computeVerdict({ ...base, type: "EBIKE", feeling: "HARD" }), null);
assert.equal(computeVerdict({ ...base, type: "RIDE", source: "google-fit", feeling: "HARD" }), null);
assert.equal(computeVerdict({ ...base, type: "RIDE", dedupeKey: "gfit-123", feeling: "HARD" }), null);

// ── Musculation ──
const d = (iso: string) => new Date(iso + "T08:00:00Z");
const row = (id: string, day: string, name: string, sets: number, reps: number, done: number[]): StrengthRow =>
  ({ activityId: id, startedAt: d(day), name, sets, reps, loadKg: null, setsDetail: done.map((r) => ({ reps: r, loadKg: null, done: true })) });
const lift = (rows: StrengthRow[]): SessionInput => ({ type: "WORKOUT", startHour: 19, secondOfDay: false, workoutKind: "HAUT", exercises: [{ rows }] });
const s6 = (n: number) => [n, n, n, n, n, n];

// validated : 6 séries à la cible
const v = computeVerdict(lift([row("a2", "2026-10-19", "B1 - dips", 6, 8, s6(8)), row("a1", "2026-10-12", "B1 - dips", 6, 8, s6(8))]))!; // même total que le meilleur : pas de record
assert.equal(v.kind, "validated");
assert.equal(commentTemplate(v), "Cible de répétitions validée sur les 6 séries. Le volume de travail est atteint pour ce cycle.");
// première séance de l'exercice : validée sans comparaison
assert.equal(kindOf(lift([row("a1", "2026-10-12", "B1 - dips", 6, 8, s6(8))])), "validated");
// constrained en muscu
assert.equal(computeVerdict({ ...lift([row("a1", "2026-10-12", "B1 - dips", 6, 8, s6(8))]), startHour: 22 })?.kind, "constrained");
// record : meilleur total sur la variante
const r = computeVerdict(lift([row("a3", "2026-10-26", "B2 - dips", 6, 8, [9, 8, 8, 8, 8, 8]), row("a2", "2026-10-19", "B2 - dips", 6, 8, s6(8)), row("a1", "2026-10-12", "B2 - dips", 6, 8, [8, 8, 8, 8, 6, 5])]))!;
assert.equal(r.kind, "record"); assert.equal(r.facts.recordReps, 49); assert.equal(r.facts.recordGain, 1);
// un total plus haut sur une AUTRE variante n'est pas un record
assert.equal(kindOf(lift([row("a3", "2026-10-26", "B2 - dips", 6, 8, s6(6)), row("a2", "2026-10-19", "B1 - dips", 6, 12, s6(12))])), null);
// underperformance : 38 reps (-4 vs 42), blocage 1/2
const u = computeVerdict(lift([row("a2", "2026-10-19", "B1 - dips", 6, 8, [7, 7, 6, 6, 6, 6]), row("a1", "2026-10-12", "B1 - dips", 6, 8, [8, 8, 7, 7, 6, 6])]))!;
assert.equal(u.kind, "underperformance"); assert.equal(u.facts.deltaReps, -4); assert.equal(u.facts.totalReps, 38); assert.equal(u.facts.stall, 1); assert.equal(u.facts.blocked, false);
assert.equal(commentTemplate(u), "Total 38 reps (-4 vs séance précédente). Blocage 1/2. Récupération complète avant la prochaine séance Haut du corps.");
// blocage 2 : l'état vient d'applyLafayProgress
const b = computeVerdict(lift([
  row("a3", "2026-10-26", "B1 - dips", 6, 8, [7, 7, 7, 7, 6, 6]), row("a2", "2026-10-19", "B1 - dips", 6, 8, [8, 8, 7, 7, 7, 7]), row("a1", "2026-10-12", "B1 - dips", 6, 8, [8, 8, 8, 7, 7, 7]),
]))!;
assert.equal(b.kind, "underperformance"); assert.equal(b.facts.stall, 2); assert.equal(b.facts.blocked, true);
// priorité : record > underperformance
const both = computeVerdict({ ...lift([]), exercises: [
  { rows: [row("a2", "2026-10-19", "B1 - dips", 6, 8, s6(5)), row("a1", "2026-10-12", "B1 - dips", 6, 8, s6(8))] },
  { rows: [row("a2", "2026-10-19", "C1 - tractions", 6, 5, s6(6)), row("a1", "2026-10-12", "C1 - tractions", 6, 5, s6(5))] },
] })!;
assert.equal(both.kind, "record");

// ── Tous les gabarits passent le garde-fou ──
const samples = [rec, val, drift, v, r, u, b, { kind: "constrained" as const, facts: { sport: "RUN" as const } },
  { kind: "fatigue" as const, facts: { sport: "RUN" as const, decouplingPct: 6.2 } }, { kind: "fatigue" as const, facts: { sport: "RUN" as const, feeling: "HARD" as const } }];
for (const s of samples) { const t = commentTemplate(s); assert.equal(validateComment(t, s.kind).ok, true, `${s.kind} : ${t}`); }

guardFlow().then(() => console.log("test-session-verdict : OK"), (e) => { console.error(e); process.exit(1); });
