/**
 * Planification des notifications (pur, tests : tools/test-notify.ts).
 *
 * Vercel Hobby : chaque cron tourne au plus une fois par jour, à l'heure près (déclenché entre HH:00 et HH:59), en UTC ;
 * jusqu'à 100 crons par projet. D'où un cron par usage, et un cron quotidien par heure pour le rappel :
 *
 *   /api/cron/notify/matin      cron-job.org, toutes les 15 min de 5 h à 9 h 45 (Europe/Paris), pas dans vercel.json :
 *                               la route décide d'envoyer (morningGate : heure réglée atteinte, avant 10 h)
 *   /api/cron/notify/rappel-HH  0 HH * * *      HH = 06 … 20 UTC : Paris été 8 h – 23 h, hiver 7 h – 22 h
 *   /api/cron/notify/bilan      0 18 * * 0      dimanche, Paris été 20 h – 21 h, hiver 19 h – 20 h
 *
 * Le rappel part au premier passage qui tombe moins de 100 min avant le créneau du coach (donc entre ~100 et ~0 min avant,
 * le plus souvent 30 à 90 min). Un même type n'est envoyé qu'une fois par jour (table NotificationLog).
 */
import type { NotifyKind } from "./content";

export const REMINDER_HOURS_UTC = Array.from({ length: 15 }, (_, k) => 6 + k); // 6 … 20

export type NotifyJob = { kind: NotifyKind; job: string };

/** « matin » | « rappel-14 » | « bilan » → type de notification ; null si inconnu. */
export function parseJob(job: string): NotifyJob | null {
  if (job === "matin") return { kind: "morning", job };
  if (job === "bilan") return { kind: "weekly", job };
  const m = /^rappel-(\d{2})$/.exec(job);
  if (m && REMINDER_HOURS_UTC.includes(Number(m[1]))) return { kind: "reminder", job };
  return null;
}

/** Les entrées « crons » de vercel.json pour les notifications (gardées en phase par le test). */
export function notifyCrons() {
  return [
    ...REMINDER_HOURS_UTC.map((h) => ({ path: `/api/cron/notify/rappel-${String(h).padStart(2, "0")}`, schedule: `0 ${h} * * *` })),
    { path: "/api/cron/notify/bilan", schedule: "0 18 * * 0" },
  ];
}

/** Heure de fin du coach du matin (heure locale) : plus rien n'est envoyé à partir de là. */
export const MORNING_CUTOFF = "10:00";

/** « HH:mm » actuelle dans le fuseau donné (Intl, sans calcul d'offset à la main). */
export function clockTime(now: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** Le coach du matin peut-il partir maintenant ? null = oui, sinon la raison (comparaison de « HH:mm » zéro-complétés). */
export function morningGate(now: Date, tz: string, time: string): string | null {
  const t = clockTime(now, tz);
  if (t >= MORNING_CUTOFF) return "trop tard (après 10 h)";
  if (t < time) return `pas encore l'heure (${time})`;
  return null;
}

/**
 * Dernier passage utile de cron-job.org (toutes les 15 min, dernier à 9 h 45) : à partir de 9 h 30, un échec n'aura
 * plus de rattrapage, la route le signale alors en erreur (mail de cron-job.org). Avant, elle répond 200 et le passage suivant réessaie.
 */
export const MORNING_LAST_RETRY = "09:30";
export const morningCanRetry = (now: Date, tz: string) => clockTime(now, tz) < MORNING_LAST_RETRY;

/** Jour ISO (1 = lundi … 7 = dimanche) dans le fuseau donné. */
export function isoDow(ms: number, tz: string) {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(new Date(ms));
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d) + 1;
}
