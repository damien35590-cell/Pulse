/**
 * Planification des notifications (pur, tests : tools/test-notify.ts).
 *
 * Vercel Hobby : chaque cron tourne au plus une fois par jour, à l'heure près (déclenché entre HH:00 et HH:59), en UTC ;
 * jusqu'à 100 crons par projet. D'où un cron par usage, et un cron quotidien par heure pour le rappel :
 *
 *   /api/cron/notify/matin      0 5 * * *       Paris été 7 h – 8 h, hiver 6 h – 7 h (toujours avant le vélo de 8 h)
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
    { path: "/api/cron/notify/matin", schedule: "0 5 * * *" },
    ...REMINDER_HOURS_UTC.map((h) => ({ path: `/api/cron/notify/rappel-${String(h).padStart(2, "0")}`, schedule: `0 ${h} * * *` })),
    { path: "/api/cron/notify/bilan", schedule: "0 18 * * 0" },
  ];
}

/** Jour ISO (1 = lundi … 7 = dimanche) dans le fuseau donné. */
export function isoDow(ms: number, tz: string) {
  const d = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short" }).format(new Date(ms));
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(d) + 1;
}
