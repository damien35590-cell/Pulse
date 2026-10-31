// Lancer avec : npx tsx tools/test-coach-notes.ts
import { muscleVolume } from "../lib/workout/body";
import assert from "node:assert/strict";
import { exceptionalPrevious, frame, overviewNotes as overview, timeChange, planNotes, rankNotes, rateChange, runNotes as run, strengthNotes as strength, type CoachAct, type CoachNote } from "../lib/analytics/coach-notes";
import type { StrengthAnalysis } from "../lib/analytics/strength";

const tz = "Europe/Paris", now = new Date("2026-10-23T10:00:00Z"); // vendredi
const period = { weeks: 4, tz, now, current: true };
const act = (type: string, day: string, min: number, o: Partial<CoachAct> = {}): CoachAct => ({
  type, title: "Séance", source: "fit", dedupeKey: null, startedAt: new Date(day + "T08:00:00Z"), distanceM: 0, movingTimeS: min * 60, load: 50, ...o,
});
// Les règles se testent sans le plafond d'affichage (2) ; le plafond a ses propres assertions plus bas.
const overviewNotes = (i: Parameters<typeof overview>[0]) => overview({ max: 20, ...i });
const runNotes = (i: Parameters<typeof run>[0]) => run({ max: 20, ...i });
const strengthNotes = (i: Parameters<typeof strength>[0]) => strength({ max: 20, ...i });
const ids = (l: CoachNote[]) => l.map((n) => n.id);
const byId = (l: CoachNote[], id: string) => l.find((n) => n.id === id);

// Bornes : 4 semaines du lundi 28 sept. au vendredi 23 oct., 3 semaines terminées
const f = frame(period);
assert.equal(f.startKey, "2026-09-28"); assert.equal(f.endKey, "2026-10-23");
assert.equal(f.prevStart, "2026-08-31"); assert.equal(f.prevEnd, "2026-09-27");
assert.equal(f.span, 26); assert.equal(f.fullWeeks, 3); assert.equal(f.lastFullMon, "2026-10-12");
assert.equal(frame({ ...period, current: false }).fullWeeks, 4);

// Variation à durée égale : 26 jours contre 28
assert.equal(rateChange(26, 26, 28, 28), 0);
assert.equal(rateChange(10, 26, 0, 28), null);

// Classement : alertes d'abord, 2 au plus
const n = (id: string, tone: CoachNote["tone"]): CoachNote => ({ id, tone, title: id, body: "" });
assert.deepEqual(ids(rankNotes([n("a", "info"), n("b", "good"), n("c", "bad"), n("d", "warn"), n("e", "warn")])), ["c", "d"], "deux commentaires au plus, alerte puis vigilance");

// Programmes : suivi, séances clés manquées
assert.equal(planNotes([{ sport: "RUN", name: "Base VMA", planned: 1, done: 0, missedKey: 0 }]).length, 0, "une seule séance prévue : rien à dire");
let p = planNotes([{ sport: "RUN", name: "Base VMA", planned: 10, done: 9, missedKey: 0 }])[0];
assert.equal(p.tone, "good"); assert.equal(p.title, "Programme suivi à 90 %");
p = planNotes([{ sport: "RUN", name: "Base VMA", planned: 6, done: 2, missedKey: 2 }])[0];
assert.equal(p.tone, "bad"); assert.match(p.body, /2 séances clés manquées/); assert.equal(p.action?.href, "/plan");

// ───────── Tous ─────────
// Régulier : 2 courses + 2 muscu par semaine, période précédente identique
const regular: CoachAct[] = [];
for (let w = 0; w < 8; w++) {
  const mon = new Date(Date.UTC(2026, 7, 31 + 7 * w)).toISOString().slice(0, 10), d = (i: number) => new Date(Date.parse(mon) + i * 864e5).toISOString().slice(0, 10);
  if (d(0) > "2026-10-23") break;
  regular.push(act("RUN", d(1), 45, { distanceM: 8000 }), act("WORKOUT", d(2), 40), act("RUN", d(4), 50, { distanceM: 9000 }), act("WORKOUT", d(5), 40));
}
const live = regular.filter((a) => +a.startedAt <= +now);
let o = overviewNotes({ acts: live, period });
assert.equal(byId(o, "freq")?.tone, "good", "4 séances par semaine : dans la cible");
assert.equal(byId(o, "volume")?.title, "Volume stable");
assert.ok(!ids(o).some((i) => i.startsWith("gap-")), "rien ne manque");
assert.ok(overview({ acts: live, period }).length <= 2, "affichage : 2 commentaires au plus");

// Vélotaf et marche ne comptent pas
o = overviewNotes({ acts: [...live, ...Array.from({ length: 20 }, (_, i) => act("EBIKE", `2026-10-${String(1 + i).padStart(2, "0")}`, 30, { title: "Vélotaf" }))], period });
assert.equal(byId(o, "volume")?.title, "Volume stable");

// Plus de course depuis 10 jours
const noRun = live.filter((a) => !(a.type === "RUN" && +a.startedAt > +new Date("2026-10-14T00:00:00Z")));
o = overviewNotes({ acts: noRun, period });
assert.equal(byId(o, "gap-RUN")?.title, "Pas de course depuis 10 jours");
assert.equal(byId(o, "gap-RUN")?.tone, "warn");
assert.equal(overviewNotes({ acts: noRun, period: { ...period, current: false } }).find((x) => x.id === "gap-RUN"), undefined, "période passée : pas d'alerte d'absence");

// Grosse semaine : la charge des 7 derniers jours explose
const spike = [...live, ...["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"].map((d) => act("RUN", d, 90, { distanceM: 15000, load: 160 }))];
o = overviewNotes({ acts: spike, period });
assert.equal(byId(o, "acwr")?.tone, "bad");
assert.equal(o[0].id, "acwr", "l'alerte passe en premier");

// Peu de séances
o = overviewNotes({ acts: live.filter((a) => a.type === "WORKOUT").filter((_, i) => i % 2), period });
assert.equal(byId(o, "freq")?.tone, "warn");

// ───────── Course ─────────
// Allure : 5:30 → 5:10 /km sur la période
const runs: CoachAct[] = ["2026-09-29", "2026-10-02", "2026-10-06", "2026-10-09", "2026-10-13", "2026-10-16", "2026-10-20"].map((d, i) =>
  act("RUN", d, 0, { distanceM: 8000, movingTimeS: Math.round(8 * (330 - i * (20 / 6))) }));
let r = runNotes({ acts: runs, period });
assert.equal(byId(r, "pace")?.tone, "good");
assert.match(byId(r, "pace")!.body, /5:2\d à 5:1\d/);
assert.equal(byId(r, "freq")?.tone, "good");

// Objectif : prédiction et sortie longue
r = runNotes({ acts: runs, period, goal: { title: "10 km en 44:00", distanceM: 10000, targetTimeS: 2640, predictedTimeS: 2790 } });
assert.equal(byId(r, "goal")?.title, "2:30 à gagner");
assert.equal(byId(r, "goal")?.tone, "warn");
r = runNotes({ acts: runs, period, goal: { title: "Semi", distanceM: 21097, targetTimeS: null, predictedTimeS: null } });
assert.match(byId(r, "long")!.body, /8 km/);

// Hausse brutale du kilométrage
const ramp = [...runs, act("RUN", "2026-10-14", 60, { distanceM: 12000 }), act("RUN", "2026-10-17", 90, { distanceM: 16000 })];
assert.equal(byId(runNotes({ acts: ramp, period }), "ramp")?.tone, "warn");
assert.deepEqual(runNotes({ acts: [], period }), []);

// ───────── Muscu ─────────
const sa = (o: Partial<StrengthAnalysis> = {}): StrengthAnalysis => ({
  empty: false, summary: { sessions: 10, sets: 120, reps: 1000, tonnage: null }, weekly: [],
  exercises: [], regularity: { perWeek: 2.5, target: [2, 3], upperPct: 50, lowerPct: 50 }, insights: [], muscles: muscleVolume([]), prev: { sessions: 10, reps: 800 }, ...o,
});
const ex = (name: string, status: "progress" | "stall1" | "stall2" | "evolve", hint: string | null = null) => ({
  key: name, name, variant: null, level: "6×8", status, sessions: 4, repsPerSession: [], hardPerSession: [], points: [], lastDay: "2026-10-20", hint, nextVariant: null, restartTarget: null,
});
let s = strengthNotes({ data: sa({ exercises: [ex("Dips B2", "stall2", "passe à B à 6×6"), ex("Pompes", "progress"), ex("Tractions", "progress")] }), period });
assert.equal(s[0].id, "stuck");
assert.match(s[0].body, /Dips B2 : passe à B à 6×6/);
assert.equal(byId(s, "progress")?.title, "2 exercices sur 3 en progrès");
assert.equal(byId(s, "freq")?.tone, "good");
assert.equal(byId(s, "volume")?.title, `+${rateChange(1000, 26, 800, 28)} % de répétitions`);
s = strengthNotes({ data: sa({ regularity: { perWeek: 1.2, target: [2, 3], upperPct: 80, lowerPct: 20 } }), period });
assert.equal(byId(s, "freq")?.tone, "warn");
assert.equal(byId(s, "balance")?.title, "Le bas du corps est en retrait");
assert.deepEqual(strengthNotes({ data: sa({ empty: true }), period }), []);

// Moins de 3 séances sur la période : une seule ligne, aucune affirmation par exercice ni sur l'équilibre haut / bas
const few = strengthNotes({ data: sa({ summary: { sessions: 2, sets: 20, reps: 200, tonnage: null }, exercises: [ex("Dips B2", "stall2", "repars"), ex("Pompes", "progress")], regularity: { perWeek: 2.5, target: [2, 3], upperPct: 90, lowerPct: 10 } }), period });
assert.deepEqual(few.map((x) => x.title), ["Pas assez de séances pour juger la progression (2 / 3)."]);
assert.ok(!ids(strengthNotes({ data: sa({ summary: { sessions: 3, sets: 30, reps: 300, tonnage: null }, exercises: [ex("Pompes", "progress")] }), period })).includes("few"), "à 3 séances, le coach juge");

// Temps : la tuile « Temps » de l'Analyse et la ligne « % de temps » du coach sortent du MÊME calcul (timeChange), sur la même période
const mk: CoachAct[] = [];
for (let w = 0; w < 8; w++) {
  const mon = Date.UTC(2026, 7, 31 + 7 * w);
  for (const [i, min] of [[0, 40], [2, 60 + (w >= 4 ? 40 : 0)], [5, 50]]) mk.push(act(w % 2 ? "RUN" : "WORKOUT", new Date(mon + (i as number) * 864e5).toISOString().slice(0, 10), min as number));
}
const used = mk.filter((a) => +a.startedAt <= +now);
const tc = timeChange(used, period);
assert.equal(tc.pct, rateChange(tc.cur, frame(period).span, tc.prev, frame(period).prevSpan), "même formule que le coach");
const vol = byId(overviewNotes({ acts: mk, period }), "volume");
assert.ok(vol && vol.title.includes(String(Math.abs(tc.pct!))), `coach « ${vol?.title} » = tuile ${tc.pct} %`);

console.log("coach-notes : OK");

// Période précédente exceptionnelle (5 jours de randonnée en septembre) : ni « -81 % », ni alerte, on compare au volume habituel
{
  const trip = ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"].map((day) => act("HIKE", day, 360, { distanceM: 20000 }));
  const lighter = live.filter((a) => +a.startedAt >= +new Date("2026-09-28T00:00:00Z") ? !(a.type === "WORKOUT") : true); // période en cours plus légère
  const odd = overviewNotes({ acts: [...lighter, ...trip], period });
  const v = byId(odd, "volume");
  assert.ok(v, "une ligne de volume reste affichée");
  assert.equal(v!.tone, "info", "style neutre, pas « À surveiller »");
  assert.equal(v!.title, "Période précédente exceptionnelle (randonnée) : comparaison peu parlante.");
  assert.match(v!.body, /volume hebdomadaire habituel/);
  assert.ok(!/-\d+ % de temps/.test(odd.map((x) => x.title).join(" ")), "plus de « -x % de temps »");
  assert.ok(overview({ acts: [...lighter, ...trip], period }).length <= 2, "jamais plus de 2 commentaires");
  assert.equal(exceptionalPrevious(live, period), null, "volume régulier : rien d'exceptionnel");
  assert.equal(exceptionalPrevious([...live, ...trip], period)?.label, "randonnée");
  assert.equal(exceptionalPrevious([], period), null, "sans historique : pas de médiane, pas d'exception");
}
// Une baisse de volume ordinaire n'est plus une alerte
{
  const drop = overviewNotes({ acts: live.filter((a) => +a.startedAt < +new Date("2026-09-28T00:00:00Z") || a.type === "RUN"), period });
  assert.ok(drop.every((x) => x.id !== "volume" || x.tone !== "warn"), "baisse de volume : neutre");
}
