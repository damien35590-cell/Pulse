// Fractionné (lib/training/reps.ts) : validation du découpage Intervals.icu, répétitions WORK, comparaison aux allures du programme.
// Lancer avec : npx tsx tools/test-reps.ts
import assert from "node:assert/strict";
import {
  INTERVAL_KINDS, PACE_TOLERANCE_S, isRepSession, parseIntervals, plannedTargets, readWorkReps, reviewReps, statusOf, targetPace, workRepsOf, type IcuInterval,
} from "@/lib/training/reps";
import { paceSPerKm } from "@/lib/training/resolve";
import { repsFact } from "@/lib/coach/facts";
import type { RunWorkoutStructure } from "@/types/training";

// ── Séances concernées (champ `key` de GET /api/sync/streams) ──
assert.equal(isRepSession({ kind: "INTERVALS_SHORT", isKeySession: false }), true);
assert.equal(isRepSession({ kind: "THRESHOLD", isKeySession: false }), true);
assert.equal(isRepSession({ kind: "EASY", isKeySession: true }), true, "séance clé, quel que soit son genre");
assert.equal(isRepSession({ kind: "EASY", isKeySession: false }), false);
assert.equal(isRepSession({ kind: "LONG_RUN", isKeySession: false }), false);
assert.equal(isRepSession(null), false, "sortie non reliée");
assert.ok(!INTERVAL_KINDS.includes("RECOVERY"));

// ── Validation stricte ──
const iv = (o: Partial<Record<string, unknown>> = {}) => ({
  type: "WORK", start_index: 600, end_index: 696, start_time: 600, distance: 400, moving_time: 96, average_speed: 4.17, average_heartrate: 171.6, label: "Rep", group_id: "g1", ...o,
});
const ok = parseIntervals({ icu_intervals: [iv(), iv({ type: "RECOVERY", start_index: 697, end_index: 790, average_heartrate: null })], icu_groups: [{ id: "g1" }] });
assert.ok(Array.isArray(ok), String(ok));
assert.equal((ok as IcuInterval[]).length, 2);
assert.equal((ok as IcuInterval[])[1].average_heartrate, null, "null accepté pour un champ facultatif");
assert.equal(((ok as IcuInterval[])[0] as Record<string, unknown>).label, undefined, "champs inconnus ignorés");
assert.deepEqual(parseIntervals({ icu_intervals: [] }), []);

const bad = (body: unknown, why: RegExp) => { const r = parseIntervals(body); assert.equal(typeof r, "string", JSON.stringify(body)); assert.match(r as string, why); assert.match(r as string, /^intervals/, "préfixe attendu par le script (renvoi sans découpage)"); };
bad(null, /objet/); bad([], /objet/); bad("x", /objet/);
bad({}, /icu_intervals/); bad({ icu_intervals: "WORK" }, /icu_intervals/);
bad({ icu_intervals: Array.from({ length: 501 }, () => iv()) }, /plus de 500/);
bad({ icu_intervals: [null] }, /objet/);
bad({ icu_intervals: [iv({ type: 3 })] }, /type/);
bad({ icu_intervals: [iv({ type: "<script>" })] }, /type/);
bad({ icu_intervals: [iv({ start_index: -1 })] }, /index/);
bad({ icu_intervals: [iv({ start_index: 1.5 })] }, /index/);
bad({ icu_intervals: [iv({ end_index: 10 })] }, /index/);
bad({ icu_intervals: [iv({ end_index: 60_000 })] }, /index/);
bad({ icu_intervals: [iv({ distance: "400" })] }, /distance/);
bad({ icu_intervals: [iv({ distance: -5 })] }, /distance/);
bad({ icu_intervals: [iv({ moving_time: Infinity })] }, /moving_time/);
bad({ icu_intervals: [iv({ average_speed: 40 })] }, /average_speed/);
bad({ icu_intervals: [iv({ average_heartrate: 300 })] }, /average_heartrate/);
bad({ icu_intervals: [iv(), iv({ moving_time: NaN })] }, /intervals\[1\]/);

// ── Répétitions WORK ──
const parsed = parseIntervals({
  icu_intervals: [
    iv({ type: "WARMUP", start_index: 0, end_index: 599, start_time: 0, distance: 2000, moving_time: 600 }),
    iv({ start_index: 900, end_index: 998, start_time: 900, distance: 402.4, moving_time: 98.4, average_heartrate: 175.2 }), // dans le désordre
    iv(),
    iv({ type: "RECOVERY", start_index: 697, end_index: 790, distance: 180, moving_time: 90 }),
    iv({ start_index: 1200, end_index: 1290, start_time: 1200, distance: null, moving_time: 90, average_speed: 4.5, average_heartrate: null }), // distance tirée de la vitesse
    iv({ start_index: 1400, end_index: 1402, start_time: 1400, distance: 8, moving_time: 2 }), // tour parasite
    iv({ start_index: 1500, end_index: 1590, start_time: 1500, distance: 0, moving_time: 90, average_speed: null }), // tapis sans distance
  ],
}) as IcuInterval[];
const work = workRepsOf(parsed)!;
assert.deepEqual(work, { v: 1, reps: [{ s: 600, d: 400, t: 96, hr: 172 }, { s: 900, d: 402, t: 98, hr: 175 }, { s: 1200, d: 405, t: 90 }] });
assert.equal(workRepsOf(parsed.filter((x) => x.type !== "WORK")), null, "pas de WORK : rien à enregistrer");
assert.deepEqual(readWorkReps(JSON.parse(JSON.stringify(work))), work, "aller-retour par la colonne JSON");
assert.equal(readWorkReps(null), null);
assert.equal(readWorkReps({ v: 2, reps: [] }), null);
assert.equal(readWorkReps({ v: 1, reps: [{ s: 0, d: 0, t: 0 }] }), null);

// ── Cibles du programme (mêmes allures que l'affichage : resolveSteps, VMA × %) ──
const VMA = 15;
const s8x400: RunWorkoutStructure = {
  version: 1,
  steps: [
    { kind: "step", role: "warmup", duration: { type: "time", s: 1200 }, target: { ref: "VMA", pctMin: 65, pctMax: 75 } },
    { kind: "repeat", times: 8, steps: [
      { kind: "step", role: "active", duration: { type: "distance", m: 400 }, target: { ref: "VMA", pctMin: 95, pctMax: 100 } },
      { kind: "step", role: "recovery", duration: { type: "time", s: 75 }, target: { ref: "VMA", pctMin: 50, pctMax: 60 } },
    ] },
    { kind: "step", role: "cooldown", duration: { type: "time", s: 600 }, target: { ref: "VMA", pctMin: 60, pctMax: 70 } },
  ],
};
const targets = plannedTargets(s8x400, VMA);
assert.equal(targets.length, 8, "une cible par répétition, échauffement et récupérations exclus");
assert.deepEqual(targets[0], { min: 240, max: paceSPerKm(VMA, 95) }); // 4:00 → ~4:13
assert.deepEqual(targetPace(VMA, 95, 100), targets[0]);
assert.deepEqual(plannedTargets(null, VMA), []);
assert.deepEqual(plannedTargets(s8x400, 0), []);
assert.deepEqual(plannedTargets({ version: 1, steps: [{ kind: "step", role: "active", duration: { type: "lap" }, target: { ref: "RPE", value: 8 } }] }, VMA), [null], "étape sans allure");

// statut : fourchette ± tolérance
const t = targets[0];
assert.equal(statusOf(t.min - PACE_TOLERANCE_S, t), "ok");
assert.equal(statusOf(t.min - PACE_TOLERANCE_S - 0.5, t), "fast");
assert.equal(statusOf(t.max + PACE_TOLERANCE_S, t), "ok");
assert.equal(statusOf(t.max + PACE_TOLERANCE_S + 0.5, t), "slow");

// ── Comparaison ──
const rep = (sec: number, hr?: number) => ({ s: 0, d: 400, t: sec, ...(hr ? { hr } : {}) }); // 400 m en `sec` s → allure = sec × 2.5
const mid = (t.min + t.max) / 2; // ≈ 246,3 s/km (4:06)
const r = reviewReps({ v: 1, reps: [rep(98), rep(105), rep(92), rep(100)] }, targets, VMA);
assert.deepEqual(r.reps.map((x) => x.status), ["ok", "slow", "fast", "ok"]);
assert.deepEqual(r.reps.map((x) => x.deltaS), [245, 262.5, 230, 250].map((p) => Math.round(p - mid)));
assert.deepEqual(r.reps.map((x) => x.n), [1, 2, 3, 4]);
assert.deepEqual(r.counts, { ok: 2, slow: 1, fast: 1, rated: 4 });
assert.equal(r.vmaKmh, VMA);
assert.ok(Math.abs(r.reps[1].target!.mid - mid) < 1e-9);

// moins de répétitions que prévu (séance écourtée) ou une de plus (tour en trop) : cible commune
assert.equal(reviewReps({ v: 1, reps: Array.from({ length: 9 }, () => rep(98)) }, targets).counts.ok, 9);
// cibles différentes (pyramide) : une à une, puis rien
const mixed = [targetPace(VMA, 95, 100), targetPace(VMA, 85, 88)];
const pyr = reviewReps({ v: 1, reps: [rep(98), rep(110), rep(98)] }, mixed);
assert.deepEqual(pyr.reps.map((x) => x.status), ["ok", "ok", null]);
assert.equal(pyr.reps[2].deltaS, null);
assert.equal(pyr.counts.rated, 2);
// sans séance : rien n'est noté
const none = reviewReps({ v: 1, reps: [rep(98)] }, []);
assert.deepEqual(none.counts, { ok: 0, slow: 0, fast: 0, rated: 0 });
assert.equal(none.reps[0].status, null);
assert.equal(Math.round(none.reps[0].paceS), 245);

// ── Faits du coach ──
const fact = repsFact({ ...r, session: { title: "VMA courte · 8 × 400 m" } });
assert.deepEqual(fact, {
  seance: "VMA courte · 8 × 400 m", repetitions: 4, allures: ["4:05", "4:23", "3:50", "4:10"],
  allureCible: "4:06", vmaKmh: 15, dansLaCible: 2, tropLentes: 1, tropRapides: 1, ecartsSKm: [-1, 16, -16, 4],
});
assert.deepEqual(repsFact({ ...none, session: null }), { seance: null, repetitions: 1, allures: ["4:05"] }, "sans cible : allures seules");

console.log("reps : ok");
