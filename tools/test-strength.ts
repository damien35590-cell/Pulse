// Lancer avec : npx tsx tools/test-strength.ts
import assert from "node:assert/strict";
import { buildStrengthAnalysis, type StrengthRow } from "../lib/analytics/strength";
import { lafayView } from "../lib/workout/lafay";

const tz = "Europe/Paris", now = new Date("2026-10-21T08:00:00Z"); // mercredi
const d = (iso: string) => new Date(iso + "T08:00:00Z");
const set = (reps: number, loadKg: number | null = null) => ({ reps, loadKg, done: true });
const row = (activityId: string, day: string, name: string, sets: number, reps: number, done: number[], loadKg: number | null = null): StrengthRow =>
  ({ activityId, startedAt: d(day), name, sets, reps, loadKg, setsDetail: done.map((r) => set(r, loadKg)) });

// Vide
assert.equal(buildStrengthAnalysis([], 4, tz, now).empty, true);

// B2 raté deux fois d'affilée (cible 6×10, 6 séries à 8) → 60, 53, 53 : blocage 2, variante suivante B (échelle B1 → B2 → B), cible 6×7
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
assert.equal(b.level, "6 × 7", "cible de la prochaine séance : la boucle, floor(10 × 0,7)");
assert.equal(b.nextVariant, null, "deux séances sans gain : on repart sur le même niveau");
assert.equal(b.restartTarget, 7);
assert.equal(b.sessions, 3);
assert.equal(r.exercises[0].lastDay, "2026-10-19", "tri par dernière séance");
assert.ok(r.insights.some((t) => t.includes("bloqué depuis 2 séances") && t.includes("repars à 6×7")), r.insights.join(" | "));
assert.ok(r.insights.some((t) => t.startsWith("Meilleure série : 5 × 80 kg sur Squat")), r.insights.join(" | "));

// Sans aucune charge : pas de tonnage
assert.equal(buildStrengthAnalysis(rows.slice(0, 3), 4, tz, now).summary.tonnage, null);
// Semaines vides gardées à 0
assert.equal(r.weekly.length, 4);
// ── Règles Lafay ──
const status = (rs: StrengthRow[]) => buildStrengthAnalysis(rs, 12, tz, now).exercises[0];
// 42 au total, puis 8+8+8+8+6+5 = 43 : total supérieur = progrès, même sans atteindre la cible 8 partout
let e = status([row("p1", "2026-10-05", "B1 - dips", 6, 8, [7, 7, 7, 7, 7, 7]), row("p2", "2026-10-12", "B1 - dips", 6, 8, [8, 8, 8, 8, 6, 5])]);
assert.equal(e.status, "progress");
// Seul le total compte (lib/workout/loop.ts) : 54 puis 48, même avec la cible atteinte partout = pas de gain, stagne 1/2
e = status([row("q1", "2026-10-05", "B1 - dips", 6, 9, [9, 9, 9, 9, 9, 9]), row("q2", "2026-10-12", "B1 - dips", 6, 8, [8, 8, 8, 8, 8, 8])]);
assert.equal(e.status, "stall1");
// Deux séances sans gain de total : blocage 2 → boucle sur le même niveau, floor(8 × 0,7) = 5
const flat = [0, 1, 2].map((i) => row("f" + i, `2026-10-0${5 + i * 2}`, "B1 - dips", 6, 8, [8, 8, 8, 8, 5, 5]));
e = status(flat);
assert.equal(e.status, "stall2");
assert.equal(e.nextVariant, null);
assert.equal(e.restartTarget, 5);
assert.equal(status(flat.slice(0, 2)).status, "stall1", "une seule séance sans progrès : blocage 1");
// Un changement de variante remet le compteur à zéro (B1 bloqué, puis B2 première séance)
e = status([...flat, row("g", "2026-10-14", "B2 - dips", 6, 6, [6, 6, 5, 5, 4, 4])]);
assert.equal(e.variant, "B2");
assert.equal(e.status, "progress");
// Dernière variante de l'échelle ou exercice inconnu : on repart à floor(N × 0,7) sur la même variante
e = status([0, 1, 2].map((i) => row("c" + i, `2026-10-0${5 + i * 2}`, "C - tractions", 6, 5, [5, 4, 4, 3, 3, 3])));
assert.equal(e.status, "stall2");
assert.equal(e.nextVariant, null);
assert.equal(e.restartTarget, 3);
assert.ok(e.hint!.startsWith("repars à 6×3"), e.hint!);
// Bloqué deux fois : toujours la boucle sur le même niveau ; le niveau suivant n'arrive qu'au plafond
assert.equal(status([0, 1, 2].map((i) => row("a" + i, `2026-10-0${5 + i * 2}`, "A2 - pompes", 6, 10, [9, 9, 9, 9, 9, 9]))).nextVariant, null);
assert.equal(status([0, 1, 2].map((i) => row("a" + i, `2026-10-0${5 + i * 2}`, "A3 - pompes", 6, 10, [9, 9, 9, 9, 9, 9]))).nextVariant, null);
// Plafond : N = 12 → à faire évoluer, variante suivante ; F (20) → « saute plus haut »
e = status([row("m", "2026-10-12", "C2 - tractions", 6, 12, [12, 12, 12, 12, 12, 12])]);
assert.equal(e.status, "evolve");
assert.equal(e.nextVariant, "C3");
assert.ok(e.hint!.includes("C3") && e.hint!.includes("6×8"), e.hint!);
assert.equal(status([row("j", "2026-10-12", "F", 6, 19, Array(6).fill(19))]).status, "progress", "F : plafond à 20, pas 12");
e = status([row("j", "2026-10-12", "F", 6, 20, Array(6).fill(20))]);
assert.equal(e.status, "evolve");
assert.equal(e.hint, "saute plus haut");

// Cible de l'Analyse = cible du Programme : même lafayView, mêmes séries prévues (6 au programme, la dernière séance n'en avait que 3)
{
  const hist = [row("z2", "2026-10-12", "A1 - pompes", 3, 10, [10, 10, 10]), row("z1", "2026-10-05", "A1 - pompes", 3, 9, [9, 9, 9])];
  const view = lafayView([...hist].sort((a, b) => +b.startedAt - +a.startedAt), 6);
  const card = buildStrengthAnalysis(hist, 12, tz, now, () => 6).exercises[0];
  assert.equal(card.level, `${view.target!.sets} × ${view.target!.reps}`);
  assert.equal(card.level, "6 × 11", "6 séries prévues, +1 rep");
  assert.equal(buildStrengthAnalysis(hist, 12, tz, now).exercises[0].level, "3 × 11", "sans programme : les séries de la dernière séance");
}

console.log("test-strength : ok");

// Carte des muscles : descriptive, présente dès une séance (le seuil MIN_SESSIONS ne vaut que pour juger la progression)
const one = buildStrengthAnalysis([row("m1", "2026-10-19", "Squat", 3, 5, [5, 5, 5], 80)], 4, tz, now);
assert.equal(one.summary.sessions, 1);
assert.ok(one.muscles.quads.tonnage > 0, "une seule séance suffit pour la carte");
assert.equal(buildStrengthAnalysis([], 4, tz, now).muscles.quads.tonnage, 0);
