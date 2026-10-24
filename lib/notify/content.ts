/**
 * Textes des notifications (fonctions pures, tests : tools/test-notify.ts).
 * Matin : le coach du jour en une ligne. Rappel : avant le créneau choisi par le coach. Dimanche soir : bilan de la semaine.
 */
import { fmtDuration, fmtKm, fmtNum } from "@/lib/format";
import { hhmm, REST_FORM, type CoachInput, type CoachPlan, type CoachSlot } from "@/lib/coach/today";

export type NotifyKind = "morning" | "reminder" | "weekly";
/** Ce que reçoit le service worker. `tag` : une notification remplace la précédente de même étiquette. */
export type PushMessage = { title: string; body: string; url: string; tag: string };

const dayKey = (ms: number, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const localHour = (ms: number, tz: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

/** « 12 h 30, 11 °C, sec » (+ « demain », pluie, vent fort, nuit). */
export function slotShort(s: CoachSlot, tz: string, now: number) {
  const day = dayKey(s.at, tz) === dayKey(now, tz) ? "" : "demain ";
  const rain = s.rainPct >= 60 ? "pluie probable" : s.rainPct >= 30 ? `averses possibles (${s.rainPct} %)` : "sec";
  return [`${day}${hhmm(s.at, tz)}`, `${s.feels} °C`, rain, s.windKmh >= 25 && `vent ${s.windKmh} km/h`, s.night && "de nuit"].filter(Boolean).join(", ");
}

/** Séance du programme course prévue aujourd'hui (ou en retard), pas encore faite. */
const programRunDue = (i: CoachInput) => !!i.runNext && i.runNext.date <= dayKey(i.now, i.tz);

// ───────── Matin ─────────
/**
 * Coach du matin. Rien si la séance du jour est déjà faite, ni un jour de récupération sans rien à signaler.
 * Un repos imposé par la fatigue est signalé (il bouscule le programme).
 */
export function morningMessage(i: CoachInput, plan: CoachPlan): PushMessage | null {
  if (plan.kind === "done") return null;
  if (plan.kind === "rest" && i.form.value > REST_FORM) return null;
  const url = plan.primary?.href ?? "/";
  if (plan.kind === "rest") return { title: "Coach du jour · Repos", body: plan.lines.join(" "), url, tag: "coach" };

  const head: string[] = [plan.title];
  const extra: string[] = [];
  if (plan.kind === "run") {
    if (programRunDue(i)) {
      const r = i.runNext!, late = daysBetween(r.date, dayKey(i.now, i.tz));
      head.push(`${r.minutes} min`);
      if (late > 0) extra.push(`Prévue ${late === 1 ? "hier" : `il y a ${late} jours`} : fais-la aujourd'hui.`);
      if (r.isKey && plan.tone === "easy") extra.push("Fatigue marquée : vise le bas des allures.");
    }
    if (i.slot) head.push(`meilleur créneau ${slotShort(i.slot, i.tz, i.now)}`);
  } else if (plan.kind === "lift") {
    head.push(plan.lines[0]);
  }
  return { title: `Coach du jour · ${plan.tag}`, body: [head.join(" · "), ...extra].join("\n"), url, tag: "coach" };
}

// ───────── Rappel de séance ─────────
/** Le rappel part au premier passage du cron qui tombe moins de 100 min avant le créneau (crons horaires à ±59 min près). */
export const REMINDER_LEAD_MAX_MIN = 100;
/** Sans créneau météo (domicile inconnu) : rappel au passage de 17 h. */
export const REMINDER_FALLBACK_HOUR = 17;

/**
 * Rappel de la séance du programme prévue aujourd'hui et pas faite, avant le meilleur créneau du coach.
 * Rien si le coach conseille autre chose (repos, déjà fait) ou si le créneau est demain.
 */
export function reminderMessage(i: CoachInput, plan: CoachPlan, leadMaxMin = REMINDER_LEAD_MAX_MIN): PushMessage | null {
  if (plan.kind !== "run" || !programRunDue(i)) return null;
  const r = i.runNext!, url = plan.primary?.href ?? "/plan";
  const s = i.slot;
  if (!s) {
    if (localHour(i.now, i.tz) !== REMINDER_FALLBACK_HOUR) return null;
    return { title: `Pas encore faite : ${r.title}`, body: `${r.minutes} min · il reste la soirée.`, url, tag: "coach" };
  }
  if (dayKey(s.at, i.tz) !== dayKey(i.now, i.tz)) return null;
  const lead = (s.at - i.now) / 6e4;
  if (lead < 0 || lead > leadMaxMin) return null;
  const rain = s.rainPct >= 60 ? "pluie probable" : s.rainPct >= 30 ? `averses possibles (${s.rainPct} %)` : "sec";
  const weather = [`${s.feels} °C ressentis`, rain, `vent ${s.windKmh} km/h`, s.night && "finit de nuit : frontale"].filter(Boolean).join(" · ");
  return { title: `À ${hhmm(s.at, i.tz)} : ${r.title}`, body: `${r.minutes} min · ${weather}\nPrépare tes affaires.`, url, tag: "coach" };
}

// ───────── Bilan du dimanche ─────────
export type WeekActivity = { distanceM: number; movingTimeS: number; elevationGainM: number };
export type WeekTotals = { count: number; distanceM: number; timeS: number; elevationM: number };

export function weekTotals(acts: WeekActivity[]): WeekTotals {
  return acts.reduce<WeekTotals>(
    (t, a) => ({ count: t.count + 1, distanceM: t.distanceM + a.distanceM, timeS: t.timeS + a.movingTimeS, elevationM: t.elevationM + a.elevationGainM }),
    { count: 0, distanceM: 0, timeS: 0, elevationM: 0 },
  );
}

/** ↑ / ↓ si l'écart dépasse 5 % ET un minimum absolu (500 m, 5 min, 20 m de D+, 1 sortie) ; sinon « = ». */
export function trend(cur: number, prev: number, minAbs: number) {
  const d = cur - prev;
  if (Math.abs(d) < Math.max(minAbs, Math.abs(prev) * 0.05)) return "=";
  return d > 0 ? "↑" : "↓";
}

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;
const parts = (t: WeekTotals) => [plural(t.count, "sortie"), `${fmtKm(t.distanceM)} km`, fmtDuration(t.timeS), `${fmtNum(t.elevationM, 0)} m D+`];

/** Bilan hebdo : totaux de la semaine avec flèches vs la précédente, puis séances du programme faites / prévues. */
export function weeklyMessage(cur: WeekTotals, prev: WeekTotals, program: { done: number; planned: number } | null): PushMessage {
  const lines: string[] = [];
  if (cur.count) {
    const arrows = [trend(cur.count, prev.count, 1), trend(cur.distanceM, prev.distanceM, 500), trend(cur.timeS, prev.timeS, 300), trend(cur.elevationM, prev.elevationM, 20)];
    lines.push(parts(cur).map((p, k) => `${p} ${arrows[k]}`).join(" · "));
  } else lines.push("Aucune sortie cette semaine.");
  lines.push(prev.count ? `Semaine passée : ${parts(prev).join(" · ")}` : "Semaine passée : aucune sortie.");
  if (program && program.planned > 0) {
    const all = program.done >= program.planned;
    lines.push(`Programme : ${program.done} séance${program.done > 1 ? "s" : ""} faite${program.done > 1 ? "s" : ""} sur ${program.planned}${all ? ", bravo" : ""}`);
  }
  return { title: "Bilan de la semaine", body: lines.join("\n"), url: "/analysis", tag: "bilan" };
}

// ───────── Test ─────────
export const testMessage = (): PushMessage => ({ title: "Pulse", body: "Les notifications fonctionnent sur cet appareil.", url: "/vous", tag: "test" });
