/**
 * Exécution d'un envoi planifié (appelé par /api/cron/notify/[job]) : réglages, idempotence, contenu, envoi.
 * Les textes sont dans lib/notify/content.ts (purs), la planification dans lib/notify/schedule.ts.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayKey, weekKeys } from "@/lib/dates";
import { loadCoachInput } from "@/lib/coach/load";
import { coachToday } from "@/lib/coach/today";
import { getRunProgram } from "@/lib/data/training";
import { isCommute } from "@/lib/routes/estimate";
import { syncIntervals } from "@/lib/sync/intervals";
import { sendToUser } from "@/lib/push/send";
import type { PushOptions } from "@/lib/push/webpush";
import { morningMessage, reminderMessage, weeklyMessage, weekTotals, type NotifyKind, type PushMessage } from "./content";
import { isoDow } from "./schedule";
import { getPrefs } from "./prefs";

/** Durée de vie côté service push (téléphone hors réseau) et urgence, par type. */
const DELIVERY: Record<NotifyKind, PushOptions> = {
  morning: { ttl: 3 * 3600, urgency: "normal" },
  reminder: { ttl: 3600, urgency: "high" },
  weekly: { ttl: 12 * 3600, urgency: "normal" },
};

/** Rattrape les sorties du jour depuis Intervals.icu (le cron de synchro ne passe qu'à minuit) ; ne bloque jamais l'envoi. */
async function quickSync(userId: string) {
  if (!process.env.INTERVALS_API_KEY?.trim()) return;
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 20_000));
  try { await Promise.race([syncIntervals(userId, 1), timeout]); }
  catch (e) { console.error("[notify] synchro Intervals avant envoi", e instanceof Error ? e.message : e); }
}

async function coach(userId: string, now: Date) {
  const input = await loadCoachInput(userId, await getRunProgram(userId, now), now);
  return { input, plan: coachToday(input) };
}

/** Une séance de programme course à faire aujourd'hui ou en retard ? (requête légère avant de calculer le coach) */
const hasDueRun = (userId: string, today: string) =>
  prisma.plannedSession.findFirst({ where: { userId, sport: "RUN", status: "PLANNED", date: { lte: new Date(today) }, program: { status: "ACTIVE" } }, select: { id: true } });

async function weekly(userId: string, now: Date, tz: string): Promise<PushMessage> {
  const cur = weekKeys(now, tz), prev = weekKeys(now, tz, -1);
  const [acts, sessions] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, startedAt: { gte: new Date(Date.parse(prev[0]) - 864e5), lte: new Date(+now + 864e5) } },
      select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true },
    }),
    prisma.plannedSession.findMany({ where: { userId, date: { gte: new Date(cur[0]), lte: new Date(cur[6]) }, status: { not: "MOVED" } }, select: { status: true } }),
  ]);
  // Sorties d'entraînement seulement : ni vélotaf, ni marche, ni Google Fit (comme le coach du jour).
  const training = acts.filter((a) => !isCommute(a));
  const inWeek = (keys: string[]) => { const s = new Set(keys); return training.filter((a) => s.has(dayKey(a.startedAt, tz))); };
  const done = sessions.filter((s) => s.status === "COMPLETED" || s.status === "PARTIAL").length;
  return weeklyMessage(weekTotals(inWeek(cur)), weekTotals(inWeek(prev)), sessions.length ? { done, planned: sessions.length } : null);
}

export type NotifyResult = { kind: NotifyKind; status: "sent" | "skipped" | "failed"; reason?: string; title?: string; sent?: number; removed?: number; errors?: string[] };

/**
 * Prépare et envoie une notification du type demandé à l'utilisateur de l'app.
 * `force` (tests manuels) : ignore le jour de la semaine et le journal d'envoi.
 */
export async function runNotify(userId: string, kind: NotifyKind, now = new Date(), force = false): Promise<NotifyResult> {
  const skip = (reason: string): NotifyResult => ({ kind, status: "skipped", reason });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const tz = user?.timezone ?? "Europe/Paris", today = dayKey(now, tz);

  const [prefs, subs, already] = await Promise.all([
    getPrefs(userId),
    prisma.pushSubscription.count({ where: { userId } }),
    prisma.notificationLog.findUnique({ where: { userId_kind_day: { userId, kind, day: today } }, select: { id: true } }),
  ]);
  if (!prefs[kind]) return skip("désactivée dans les réglages");
  if (!subs) return skip("aucun appareil abonné");
  if (already && !force) return skip("déjà envoyée aujourd'hui");

  let msg: PushMessage | null = null;
  if (kind === "morning") {
    const { input, plan } = await coach(userId, now);
    msg = morningMessage(input, plan);
  } else if (kind === "reminder") {
    if (!(await hasDueRun(userId, today))) return skip("pas de séance du programme à faire aujourd'hui");
    const first = await coach(userId, now);
    if (!reminderMessage(first.input, first.plan)) return skip("pas encore l'heure, ou le coach conseille autre chose");
    // C'est l'heure : on vérifie d'abord que la séance n'a pas été faite entre-temps (synchro Intervals.icu).
    await quickSync(userId);
    const { input, plan } = await coach(userId, new Date());
    msg = reminderMessage(input, plan);
  } else {
    if (isoDow(+now, tz) !== 7 && !force) return skip("le bilan part le dimanche");
    await quickSync(userId);
    msg = await weekly(userId, now, tz);
  }
  if (!msg) return skip("rien à signaler");

  // Idempotence : on réserve le créneau (userId, type, jour) AVANT d'envoyer ; un second passage concurrent échoue ici.
  let logId: string | null = null;
  if (!force) {
    try {
      logId = (await prisma.notificationLog.create({ data: { userId, kind, day: today }, select: { id: true } })).id;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return skip("déjà envoyée aujourd'hui");
      throw e;
    }
  }
  const r = await sendToUser(userId, msg, DELIVERY[kind]);
  // Rien n'est parti : on libère le créneau pour qu'un passage suivant (rappel) puisse réessayer.
  if (!r.sent && logId) await prisma.notificationLog.delete({ where: { id: logId } }).catch(() => null);
  return { kind, status: r.sent ? "sent" : "failed", title: msg.title, sent: r.sent, removed: r.removed, errors: r.errors.length ? r.errors : undefined };
}
