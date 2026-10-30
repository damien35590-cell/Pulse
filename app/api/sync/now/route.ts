import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncIntervals } from "@/lib/sync/intervals";
import { syncGoogleFit } from "@/lib/sync/google-fit";
import { syncIntervalsRuns } from "@/lib/sync/intervals-runs";
import { matchRaceActivities } from "@/lib/races/link";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Une synchro manuelle toutes les 5 minutes au plus. */
const THROTTLE_MS = 5 * 60_000;
const DAYS = 3; // même fenêtre que la tâche de nuit (/api/cron/sync-intervals)

/**
 * « Synchroniser maintenant » de la feuille « + » : Intervals.icu et Google Fit pour la personne connectée.
 * Réponse : nouvelles activités par source (null = source en échec), total, et l'heure de la synchro.
 */
export async function POST() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Réservation atomique du créneau : deux appuis rapprochés ne lancent pas deux synchros.
  const now = new Date();
  const claimed = await prisma.user.updateMany({
    where: { id: uid, OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(+now - THROTTLE_MS) } }] },
    data: { lastSyncAt: now },
  });
  if (!claimed.count) {
    const u = await prisma.user.findUnique({ where: { id: uid }, select: { lastSyncAt: true } });
    const retryAfterS = Math.max(1, Math.ceil(((u?.lastSyncAt ? +u.lastSyncAt : +now) + THROTTLE_MS - +now) / 1000));
    return NextResponse.json({ error: "throttled", retryAfterS, lastSyncAt: u?.lastSyncAt ?? null }, { status: 429, headers: { "Retry-After": String(retryAfterS) } });
  }

  // Si l'une échoue, l'autre continue (comme la tâche de nuit).
  const [intervals, googleFit] = await Promise.allSettled([syncIntervals(uid, DAYS), syncGoogleFit(uid, DAYS)]);
  // Courses Strava (via Intervals.icu) après Google Fit : elles reprennent la même sortie au lieu de la doubler.
  const [strava] = await Promise.allSettled([syncIntervalsRuns(uid)]);
  const count = (r: PromiseSettledResult<{ saved: number }>) => (r.status === "fulfilled" ? r.value.saved : null);
  // Erreurs nommées par source : la feuille « + » les affiche au lieu d'un « Déjà à jour » trompeur.
  const errors = ([["Intervals.icu", intervals], ["Google Fit", googleFit], ["Strava (Intervals.icu)", strava]] as const).flatMap(([name, r]) => (r.status === "rejected" ? [`${name} : ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`] : []));
  for (const e of errors) console.error("[sync/now]", e);
  if (intervals.status === "rejected" && googleFit.status === "rejected" && strava.status === "rejected") {
    return NextResponse.json({ error: "Synchronisation impossible", errors }, { status: 502 });
  }

  const racesLinked = await matchRaceActivities(uid).catch(() => 0);
  const counts = { intervals: count(intervals), googleFit: count(googleFit), strava: strava.status === "fulfilled" ? strava.value.created + strava.value.replacedGoogleFit : null };
  return NextResponse.json({ ...counts, total: (counts.intervals ?? 0) + (counts.googleFit ?? 0) + (counts.strava ?? 0), racesLinked, errors, lastSyncAt: now });
}
