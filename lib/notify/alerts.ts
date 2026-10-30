/** Alertes de synchro Strava (cookie Intervals expiré, cartes en attente) : au plus une notification de chaque type par 3 jours. */
import { prisma } from "@/lib/prisma";
import { sendToUser } from "@/lib/push/send";

export type AlertKind = "alert-cookie" | "alert-streams";

export const ALERT_COOLDOWN_MS = 3 * 864e5;
/** Une sortie sans carte depuis plus de 3 jours = le script Tampermonkey ne tourne plus. */
export const STREAMS_STALE_MS = 3 * 864e5;

/** Vrai si aucune alerte de ce type n'est partie dans les 3 derniers jours. */
export const alertDue = (lastSentAt: Date | null | undefined, now = Date.now()) => !lastSentAt || now - +lastSentAt >= ALERT_COOLDOWN_MS;

/** Le message d'erreur de syncIntervalsRuns signale-t-il un cookie refusé (401/403) ? */
export const isCookieError = (e: unknown) => /\((401|403)\)/.test(e instanceof Error ? e.message : String(e));

/** Nombre de sorties qui attendent leur carte depuis plus de 3 jours. */
export const staleStreamCount = (missing: { startedAt: string }[], now = Date.now()) => missing.filter((m) => now - Date.parse(m.startedAt) > STREAMS_STALE_MS).length;

export const streamsAlertBody = (n: number) => `${n} sortie(s) attendent leur carte : ouvre intervals.icu`;
export const COOKIE_ALERT_BODY = "Cookie Intervals expiré : remplace INTERVALS_SESSION_COOKIE";

/** Envoie l'alerte si elle n'est pas en sourdine ; ne lève jamais. Renvoie true si elle est partie. */
export async function sendAlert(userId: string, kind: AlertKind, body: string, url: string): Promise<boolean> {
  try {
    const last = await prisma.notificationLog.findFirst({ where: { userId, kind }, orderBy: { sentAt: "desc" }, select: { sentAt: true } });
    if (!alertDue(last?.sentAt)) return false;
    const r = await sendToUser(userId, { title: "Pulse", body, url, tag: kind }, { ttl: 6 * 3600, urgency: "normal" });
    if (!r.sent) return false;
    // Le jour (clé unique avec le type) porte l'heure d'envoi pour ne jamais entrer en collision.
    await prisma.notificationLog.create({ data: { userId, kind, day: new Date().toISOString() } });
    return true;
  } catch (e) {
    console.error(`[cron] alerte ${kind}`, e);
    return false;
  }
}
