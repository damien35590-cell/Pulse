// Lancer avec : npx tsx tools/test-notify.ts
// Textes des notifications (coach du matin, rappel, bilan du dimanche) et planification des crons.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coachToday, type CoachInput } from "../lib/coach/today";
import { morningMessage, reminderMessage, slotShort, trend, weeklyMessage, weekTotals, REMINDER_LEAD_MAX_MIN, testMessage } from "../lib/notify/content";
import { clockTime, isoDow, morningGate, notifyCrons, parseJob, REMINDER_HOURS_UTC } from "../lib/notify/schedule";

const tz = "Europe/Paris";
const day = 864e5, min = 6e4;
// Mercredi 21 octobre 2026, 7 h 30 à Paris (UTC+2).
const morning = Date.parse("2026-10-21T05:30:00Z");
const base: CoachInput = {
  now: morning, tz, form: { value: -5, label: "Zone neutre" }, todayDone: [],
  lastRunAt: morning - day, lastLiftAt: morning - day, lastLiftHalf: "upper", runNext: null, slot: null, classic: null,
};
const run = { title: "Fractionné 8 × 400 m", summary: "20 min d'échauffement, 8 × 400 m à 4'05/km", minutes: 50, date: "2026-10-21", isKey: true, kind: "INTERVALS_SHORT" };
const noon = { at: Date.parse("2026-10-21T10:30:00Z"), feels: 11, rainPct: 10, windKmh: 12, night: false }; // 12 h 30 à Paris
const both = (i: CoachInput) => [i, coachToday(i)] as const;

// ── Créneau en une ligne ──
assert.equal(slotShort(noon, tz, morning), "12 h 30, 11 °C, sec");
assert.equal(slotShort({ ...noon, rainPct: 40, windKmh: 30 }, tz, morning), "12 h 30, 11 °C, averses possibles (40 %), vent 30 km/h");
assert.equal(slotShort({ ...noon, at: noon.at + day, rainPct: 70, night: true }, tz, morning), "demain 12 h 30, 11 °C, pluie probable, de nuit");

// ── Coach du matin ──
{
  const m = morningMessage(...both({ ...base, runNext: run, slot: noon }))!;
  assert.equal(m.title, "Coach du jour · Séance clé");
  assert.equal(m.body, "Fractionné 8 × 400 m · 50 min · meilleur créneau 12 h 30, 11 °C, sec");
  assert.equal(m.url, "/itineraires?sport=RUN&minutes=50&session=intervals", "clic : boucle adaptée à la séance");
  assert.equal(m.tag, "coach");

  // Séance en retard, fatigue marquée sur une séance clé.
  const late = morningMessage(...both({ ...base, form: { value: -22, label: "Fatigue" }, runNext: { ...run, date: "2026-10-20" } }))!;
  assert.equal(late.body.split("\n")[0], "Fractionné 8 × 400 m · 50 min", "sans domicile : pas de créneau");
  assert.ok(late.body.includes("Prévue hier : fais-la aujourd'hui."), late.body);
  assert.ok(late.body.includes("Fatigue marquée"), late.body);

  // Muscu du jour.
  const lift = morningMessage(...both({ ...base, lastLiftAt: morning - 2 * day, lastLiftHalf: "upper" }))!;
  assert.equal(lift.title, "Coach du jour · Muscu");
  assert.ok(lift.body.startsWith("Séance bas du corps + abdos · Squats sautés"), lift.body);
  assert.equal(lift.url, "/record/session");

  // Footing proposé sans programme.
  const easy = morningMessage(...both({ ...base, lastRunAt: morning - 4 * day, slot: noon }))!;
  assert.equal(easy.body, "Footing facile · 40 min · meilleur créneau 12 h 30, 11 °C, sec");

  // Rien : séance déjà faite, ou récupération sans rien à signaler.
  assert.equal(morningMessage(...both({ ...base, runNext: run, todayDone: [{ type: "RUN", title: "Course matinale" }] })), null, "déjà faite");
  const rest = both(base);
  assert.equal(rest[1].kind, "rest");
  assert.equal(morningMessage(...rest), null, "repos sans rien à signaler");

  // Repos imposé par la fatigue alors qu'une séance était prévue : on le dit.
  const tired = morningMessage(...both({ ...base, form: { value: -35, label: "Risque élevé" }, runNext: run }))!;
  assert.equal(tired.title, "Coach du jour · Repos");
  assert.ok(tired.body.includes("Fractionné 8 × 400 m peut attendre demain."), tired.body);
  assert.equal(tired.url, "/");
}

// ── Rappel de séance ──
{
  const at = (iso: string) => ({ ...base, now: Date.parse(iso), runNext: run, slot: noon });
  // 11 h 10 à Paris : 80 min avant 12 h 30 → rappel.
  const r = reminderMessage(...both(at("2026-10-21T09:10:00Z")))!;
  assert.equal(r.title, "À 12 h 30 : Fractionné 8 × 400 m");
  assert.equal(r.body, "50 min · 11 °C ressentis · sec · vent 12 km/h\nPrépare tes affaires.");
  assert.equal(r.url, "/itineraires?sport=RUN&minutes=50&session=intervals");
  assert.equal(r.tag, "coach", "remplace la notification du matin");
  // Trop tôt (10 h : 150 min avant), créneau passé, créneau demain.
  assert.equal(reminderMessage(...both(at("2026-10-21T08:00:00Z"))), null, "trop tôt");
  assert.ok(reminderMessage(...both(at("2026-10-21T08:00:00Z")), 150), "fenêtre réglable");
  assert.equal(reminderMessage(...both(at("2026-10-21T10:40:00Z"))), null, "créneau passé");
  assert.equal(reminderMessage(...both({ ...at("2026-10-21T19:00:00Z"), slot: { ...noon, at: noon.at + day } })), null, "créneau demain : le matin s'en charge");
  assert.ok(REMINDER_LEAD_MAX_MIN >= 60 + 30, "crons horaires à ±59 min : la fenêtre doit couvrir plus d'une heure");
  // Pluie et nuit.
  const wet = reminderMessage(...both({ ...at("2026-10-21T17:00:00Z"), slot: { at: Date.parse("2026-10-21T17:30:00Z"), feels: 8, rainPct: 65, windKmh: 20, night: true } }))!;
  assert.equal(wet.title, "À 19 h 30 : Fractionné 8 × 400 m");
  assert.ok(wet.body.includes("pluie probable · vent 20 km/h · finit de nuit : frontale"), wet.body);
  // Pas de rappel : déjà faite, footing hors programme, séance future, repos de fatigue.
  assert.equal(reminderMessage(...both({ ...at("2026-10-21T09:10:00Z"), todayDone: [{ type: "RUN", title: "Fractionné" }] })), null);
  assert.equal(reminderMessage(...both({ ...at("2026-10-21T09:10:00Z"), runNext: null, lastRunAt: morning - 4 * day })), null, "footing libre : pas de rappel");
  assert.equal(reminderMessage(...both({ ...at("2026-10-21T09:10:00Z"), runNext: { ...run, date: "2026-10-22" } })), null);
  assert.equal(reminderMessage(...both({ ...at("2026-10-21T09:10:00Z"), form: { value: -35, label: "Risque élevé" } })), null);
  // Sans créneau (domicile inconnu) : un seul rappel, au passage de 17 h.
  const noSlot = (iso: string) => reminderMessage(...both({ ...at(iso), slot: null }));
  assert.equal(noSlot("2026-10-21T14:30:00Z"), null, "16 h 30");
  assert.equal(noSlot("2026-10-21T15:20:00Z")?.title, "Pas encore faite : Fractionné 8 × 400 m", "17 h 20");
  assert.equal(noSlot("2026-10-21T16:05:00Z"), null, "18 h 05");
}

// ── Bilan du dimanche ──
{
  const w = (km: number, h: number, dplus: number) => ({ distanceM: km * 1000, movingTimeS: h * 3600, elevationGainM: dplus });
  const cur = weekTotals([w(10, 0.9, 120), w(8.5, 0.75, 80), w(14, 1.5, 220)]);
  assert.deepEqual(cur, { count: 3, distanceM: 32500, timeS: 3.15 * 3600, elevationM: 420 });
  const prev = weekTotals([w(12, 1.2, 150), w(15.3, 2.3, 150)]);

  assert.equal(trend(3, 2, 1), "↑");
  assert.equal(trend(2, 3, 1), "↓");
  assert.equal(trend(3, 3, 1), "=");
  assert.equal(trend(10200, 10000, 500), "=", "écart sous le minimum absolu");
  assert.equal(trend(10400, 10000, 300), "=", "écart sous 5 %");
  assert.equal(trend(10600, 10000, 300), "↑");
  assert.equal(trend(500, 0, 20), "↑", "semaine précédente vide");

  const m = weeklyMessage(cur, prev, { done: 3, planned: 4 });
  const lines = m.body.split("\n");
  assert.equal(m.title, "Bilan de la semaine");
  assert.equal(lines[0], "3 sorties ↑ · 32,5 km ↑ · 3 h 09 ↓ · 420 m D+ ↑");
  assert.equal(lines[1], "Semaine passée : 2 sorties · 27,3 km · 3 h 30 · 300 m D+");
  assert.equal(lines[2], "Programme : 3 séances faites sur 4");
  assert.equal(m.url, "/analysis");
  assert.equal(m.tag, "bilan");

  assert.equal(weeklyMessage(cur, prev, { done: 2, planned: 2 }).body.split("\n")[2], "Programme : 2 séances faites sur 2, bravo");
  assert.equal(weeklyMessage(cur, prev, { done: 1, planned: 3 }).body.split("\n")[2], "Programme : 1 séance faite sur 3");
  assert.equal(weeklyMessage(cur, prev, null).body.split("\n").length, 2, "sans programme : pas de ligne");

  const empty = weekTotals([]);
  const quiet = weeklyMessage(empty, prev, { done: 0, planned: 3 }).body.split("\n");
  assert.equal(quiet[0], "Aucune sortie cette semaine.");
  assert.equal(quiet[2], "Programme : 0 séance faite sur 3");
  assert.equal(weeklyMessage(cur, empty, null).body.split("\n")[1], "Semaine passée : aucune sortie.");
  assert.equal(weeklyMessage(weekTotals([w(10, 1, 0)]), weekTotals([w(10, 1, 0)]), null).body.split("\n")[0], "1 sortie = · 10 km = · 1 h 00 = · 0 m D+ =");
}

assert.equal(testMessage().url, "/vous");

// ── Planification ──
const vercelHasMatin = () => (JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { crons: { path: string }[] }).crons.some((c) => c.path.endsWith("/matin"));
{
  assert.deepEqual(parseJob("matin"), { kind: "morning", job: "matin" });
  assert.deepEqual(parseJob("bilan"), { kind: "weekly", job: "bilan" });
  assert.deepEqual(parseJob("rappel-14"), { kind: "reminder", job: "rappel-14" });
  assert.equal(parseJob("rappel-03"), null, "heure hors plage");
  assert.equal(parseJob("rappel-1"), null);
  assert.equal(parseJob("autre"), null);

  // Coach du matin : heure de Paris, été comme hiver, rien après 10 h.
  assert.equal(clockTime(new Date("2026-10-22T04:00:00Z"), "Europe/Paris"), "06:00", "été (UTC+2)");
  assert.equal(clockTime(new Date("2026-11-02T05:00:00Z"), "Europe/Paris"), "06:00", "hiver (UTC+1)");
  assert.equal(clockTime(new Date("2026-10-21T22:30:00Z"), "Europe/Paris"), "00:30");
  assert.ok(morningGate(new Date("2026-10-22T03:59:00Z"), "Europe/Paris", "06:00"), "5 h 59 : trop tôt");
  assert.equal(morningGate(new Date("2026-10-22T04:00:00Z"), "Europe/Paris", "06:00"), null);
  assert.equal(morningGate(new Date("2026-10-22T04:15:00Z"), "Europe/Paris", "06:30") === null, false, "6 h 15 < 6 h 30");
  assert.equal(morningGate(new Date("2026-10-22T07:59:00Z"), "Europe/Paris", "06:00"), null, "9 h 59");
  assert.ok(morningGate(new Date("2026-10-22T08:00:00Z"), "Europe/Paris", "06:00"), "10 h 00 : fini");
  assert.ok(!vercelHasMatin(), "le coach du matin n'est plus un cron Vercel");

  // vercel.json contient exactement les crons attendus (et garde la synchro Intervals).
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as { crons: { path: string; schedule: string }[] };
  assert.ok(vercel.crons.some((c) => c.path === "/api/cron/sync-intervals"));
  assert.deepEqual(vercel.crons.filter((c) => c.path.startsWith("/api/cron/notify/")), notifyCrons());
  assert.ok(vercel.crons.length <= 100, "Vercel : 100 crons par projet");
  for (const c of vercel.crons) {
    const [m, h, dom, mon] = c.schedule.split(" ");
    assert.ok(/^\d+$/.test(m) && /^\d+$/.test(h) && dom === "*" && mon === "*", `Hobby : une fois par jour au plus (${c.schedule})`);
    assert.ok(parseJob(c.path.split("/").pop()!) || c.path === "/api/cron/sync-intervals", c.path);
  }

  // Heures de Paris réellement couvertes, été (UTC+2) et hiver (UTC+1), sur toute la fenêtre de ±59 min de Vercel.
  const paris = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
  const parisMin = (iso: string) => { const d = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); return Number(d.slice(0, 2)) * 60 + Number(d.slice(3)); };
  for (const date of ["2026-07-15", "2026-12-15"]) {
    const h = (cron: string) => cron.split(" ")[1].padStart(2, "0");
    // Le bilan tombe le dimanche soir, entre 19 h et 21 h.
    const bilan = notifyCrons().find((c) => c.path.endsWith("/bilan"))!.schedule;
    assert.equal(bilan.split(" ")[4], "0", "dimanche (UTC) = dimanche à Paris à cette heure-là");
    assert.ok(paris(`${date}T${h(bilan)}:00:00Z`) >= 19 && paris(`${date}T${h(bilan)}:59:00Z`) <= 20, date);
  }
  // Les rappels couvrent les créneaux du midi (12 h 30) et du soir (jusqu'à 22 h 20 de départ) dans les deux saisons.
  for (const off of [1, 2]) {
    const hours = REMINDER_HOURS_UTC.map((h) => h + off);
    assert.ok(hours.includes(11) && hours.includes(12) && hours.includes(21), `UTC+${off}`);
  }
  assert.equal(isoDow(Date.parse("2026-10-25T18:30:00Z"), tz), 7, "dimanche du passage à l'heure d'hiver");
  assert.equal(isoDow(Date.parse("2026-10-25T23:30:00Z"), tz), 1, "lundi 0 h 30 à Paris");
}

console.log("test-notify : OK");
