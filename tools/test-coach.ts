// Lancer avec : npx tsx tools/test-coach.ts
import assert from "node:assert/strict";
import { bestSlot, coachToday, fitsFreeTime, liftHalf, sessionCondition, slotText, type CoachInput } from "../lib/coach/today";
import type { RideWeather } from "../lib/weather/open-meteo";

const tz = "Europe/Paris";
// Mercredi 21 octobre 2026, 10 h à Paris (UTC+2).
const now = Date.parse("2026-10-21T08:00:00Z");
const day = 864e5;
const base: CoachInput = {
  now, tz, form: { value: -5, label: "Zone neutre" }, todayDone: [],
  lastRunAt: now - 1 * day, lastLiftAt: now - 1 * day, lastLiftHalf: "upper", runNext: null, slot: null, classic: null,
};
const run = { title: "Fractionné 8 × 400 m", summary: "20 min d'échauffement, 8 × 400 m à 4'05/km, récup 1'15", minutes: 50, date: "2026-10-21", isKey: true };

// ── Moitié du corps travaillée ──
assert.equal(liftHalf(["CHEST", "TRICEPS", "LATS", "BICEPS"]), "upper");
assert.equal(liftHalf(["QUADS", "GLUTES", "ABS", "CALVES"]), "lower");
assert.equal(liftHalf(["CHEST", "QUADS"]), null, "séance mélangée : on ne devine pas");
assert.equal(liftHalf([]), null);

// ── Séance course du jour : elle passe en premier, avec le créneau et le classique ──
const slot = { at: Date.parse("2026-10-21T16:00:00Z"), feels: 11, rainPct: 10, windKmh: 12, night: false };
const r = coachToday({ ...base, lastLiftAt: now - 3 * day, runNext: run, slot, classic: { title: "Boucle vers Étang", minutes: 48 } });
assert.equal(r.kind, "run");
assert.equal(r.tag, "Séance clé");
assert.equal(r.primary?.href, "/itineraires?sport=RUN&minutes=50&session=intervals", "fractionné : la boucle cherche une ligne droite");
assert.ok(r.lines.some((l) => l.startsWith("Meilleur créneau : 18 h")), r.lines.join(" | "));
assert.ok(r.lines.some((l) => l.includes("Boucle vers Étang tient pile (48 min)")));
assert.equal(r.next, "Demain : muscu bas du corps + abdos", "muscu due : annoncée pour demain");

// Séance en retard d'un jour.
assert.ok(coachToday({ ...base, runNext: { ...run, date: "2026-10-20" } }).lines.some((l) => l.includes("Prévue hier")));

// ── Muscu : alternance haut / bas ──
const lift = coachToday({ ...base, lastLiftAt: now - 2 * day, lastLiftHalf: "upper" });
assert.equal(lift.kind, "lift");
assert.equal(lift.title, "Séance bas du corps + abdos");
assert.equal(lift.primary?.href, "/record/session");
assert.equal(coachToday({ ...base, lastLiftAt: now - 2 * day, lastLiftHalf: "lower" }).title, "Séance haut du corps");
assert.equal(coachToday({ ...base, lastLiftAt: now - 2 * day, runNext: { ...run, date: "2026-10-22" } }).next, "Demain : Fractionné 8 × 400 m · 50 min");

// ── Fatigue très élevée : repos, même avec une séance prévue ──
const rest = coachToday({ ...base, form: { value: -35, label: "Risque élevé" }, runNext: run });
assert.equal(rest.kind, "rest");
assert.equal(rest.next, "Demain : Fractionné 8 × 400 m · 50 min");

// ── Déjà fait aujourd'hui ──
const done = coachToday({ ...base, todayDone: [{ type: "RUN", title: "Footing du matin" }], runNext: run });
assert.equal(done.kind, "done");
assert.equal(done.lines[0], "Footing du matin");

// ── Sans programme : footing après 3 jours sans courir, sinon récup ──
assert.equal(coachToday({ ...base, lastRunAt: now - 4 * day }).kind, "run");
assert.equal(coachToday({ ...base, lastRunAt: now - 4 * day }).primary?.href, "/itineraires?sport=RUN&minutes=40&session=easy");
// Type de séance : le genre du programme d'abord, sinon le titre.
assert.ok(coachToday({ ...base, runNext: { ...run, title: "Sortie longue · 65′", isKey: false } }).primary?.href.endsWith("&session=long"));
assert.ok(coachToday({ ...base, runNext: { ...run, title: "Footing souple · 35′", isKey: false } }).primary?.href.endsWith("&session=easy"));
assert.ok(coachToday({ ...base, runNext: { ...run, title: "Séance", kind: "LONG_RUN" } }).primary?.href.endsWith("&session=long"));
assert.equal(coachToday({ ...base, runNext: { ...run, title: "Côtes · 8 × 45″", kind: "HILLS" } }).primary?.href, "/itineraires?sport=RUN&minutes=50", "côtes : boucle normale");
assert.equal(coachToday(base).kind, "rest");

// ── Meilleur créneau : la pluie de l'après-midi fait choisir 18 h ──
const w = (rain: number, feels: number, sunset = Date.parse("2026-10-21T16:50:00Z")): RideWeather => ({
  startAt: 0, endAt: 0, feelsMin: feels, feelsMax: feels, tempMin: feels, rainProbMax: rain, rainMm: 0, windKmh: 10, windFromDeg: 0, gustMax: 20,
  uvMax: 1, cloudMean: 50, isDay: true, sunrise: null, sunset, rain48hMm: 0, coolest: null,
});
const at = (t: number) => {
  const h = new Date(t).getUTCHours() + 2; // heure de Paris
  return h >= 12 && h < 17 ? w(70, 13) : w(5, 11);
};
const best = bestSlot(at, now, 45, tz)!;
assert.ok(best.rainPct <= 10, "créneau sec");
assert.ok(best.night, "seul créneau sec : 19 h, après le coucher du soleil");
assert.match(slotText(best, tz, now), /finit de nuit : frontale/);
assert.match(slotText(best, tz, now), /°C ressentis · sec · vent 10 km\/h/);

// ── Créneaux libres : semaine 6 h – 8 h, 12 h 30 – 13 h 30, 19 h – 23 h ; week-end 6 h – 23 h ──
const paris = (iso: string) => Date.parse(iso); // heures UTC, Paris = UTC+2 en octobre
assert.equal(fitsFreeTime(paris("2026-10-21T14:00:00Z"), 45, tz), false, "mercredi 16 h : au travail");
assert.equal(fitsFreeTime(paris("2026-10-21T10:30:00Z"), 45, tz), true, "mercredi 12 h 30 → 13 h 15 : pause du midi");
assert.equal(fitsFreeTime(paris("2026-10-21T10:30:00Z"), 70, tz), false, "70 min ne tiennent pas dans la pause du midi");
assert.equal(fitsFreeTime(paris("2026-10-21T16:00:00Z"), 45, tz), false, "mercredi 18 h : trajet retour");
assert.equal(fitsFreeTime(paris("2026-10-21T17:00:00Z"), 45, tz), true, "mercredi 19 h : libre");
assert.equal(fitsFreeTime(paris("2026-10-21T20:00:00Z"), 45, tz), true, "mercredi 22 h → 22 h 45 : libre");
assert.equal(fitsFreeTime(paris("2026-10-21T20:30:00Z"), 45, tz), false, "finirait après 23 h");
assert.equal(fitsFreeTime(paris("2026-10-21T06:00:00Z"), 45, tz), false, "mercredi 8 h : trajet vers le travail");
assert.equal(fitsFreeTime(paris("2026-10-21T05:00:00Z"), 45, tz), true, "mercredi 7 h → 7 h 45 : avant le trajet");
assert.equal(fitsFreeTime(paris("2026-10-24T08:00:00Z"), 90, tz), true, "samedi 10 h : libre");
// Mercredi 10 h, beau temps : la pause du midi est le premier créneau.
const lunch = bestSlot(() => w(5, 11, Date.parse("2026-10-21T17:30:00Z")), now, 45, tz)!;
assert.equal(slotText(lunch, tz, now).split(" · ")[0], "12 h 30");
// Séance longue (70 min) : pas le midi, le soir.
const evening = bestSlot(() => w(5, 11, Date.parse("2026-10-21T17:30:00Z")), now, 70, tz)!;
assert.ok(new Date(evening.at).getUTCHours() + 2 >= 19, `créneau du soir (${slotText(evening, tz, now)})`);

// ── Carte du jour de l'accueil : champs séparés, météo réduite à un pictogramme ──
assert.deepEqual(r.run, { steps: run.summary, late: 0, tired: false, condition: null, routeHref: "/itineraires?sport=RUN&minutes=50&session=intervals" }, "séance du jour : étapes et lien de « Prépare ta sortie »");
const late2 = coachToday({ ...base, runNext: { ...run, date: "2026-10-19" } });
assert.equal(late2.run?.late, 2, "deux jours de retard");
assert.equal(coachToday({ ...base, form: { value: -25, label: "Optimal" }, runNext: run }).run?.tired, true, "séance clé et fatigue marquée");
assert.equal(lift.run, undefined, "muscu : pas de champ course");
const easy = coachToday({ ...base, lastRunAt: now - 4 * day, slot: { ...slot, night: true } });
assert.equal(easy.run?.routeHref, "/itineraires?sport=RUN&minutes=40&session=easy");
assert.equal(easy.run?.condition, "night", "footing hors programme : pictogramme aussi");
// Pictogramme : nuit > forte pluie > chaleur ; rien quand ça ne change rien, ou si le créneau est demain.
assert.equal(sessionCondition(null, now, tz), null);
assert.equal(sessionCondition(slot, now, tz), null, "11 °C, sec, de jour : aucun pictogramme");
assert.equal(sessionCondition({ ...slot, night: true, rainPct: 80 }, now, tz), "night", "la frontale d'abord");
assert.equal(sessionCondition({ ...slot, rainPct: 60 }, now, tz), "rain");
assert.equal(sessionCondition({ ...slot, rainPct: 59 }, now, tz), null, "averses possibles : pas une forte pluie");
assert.equal(sessionCondition({ ...slot, feels: 26 }, now, tz), "heat");
assert.equal(sessionCondition({ ...slot, feels: 25 }, now, tz), null, "25 °C pile : pas encore de chaleur");
assert.equal(sessionCondition({ ...slot, at: slot.at + day, night: true }, now, tz), null, "créneau de demain : rien aujourd'hui");

console.log("test-coach : OK");
