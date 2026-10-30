import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncIntervals } from "@/lib/sync/intervals";
import { syncIntervalsRuns } from "@/lib/sync/intervals-runs";
import { syncProgramToIntervals } from "@/lib/sync/intervals-calendar";
import { syncGoogleFit } from "@/lib/sync/google-fit";
import { matchRaceActivities } from "@/lib/races/link";
import { buildAllHabits } from "@/lib/habits/build";
import { DriveAuthError, backupToDrive } from "@/lib/backup/drive-backup";
import { sendToUser } from "@/lib/push/send";
import { BACKFILL_CAP, backfillRibbons, refreshHrMaxEstimate } from "@/lib/data/zone-ribbon";

export const maxDuration = 60;
/** Temps écoulé après lequel on ne démarre plus de ruban (la fonction est limitée à 60 s). */
const RIBBON_BUDGET_MS = 40_000;
export const dynamic = "force-dynamic";
/** Passage de l'après-midi (14 h à Paris en hiver, après la course du midi ; doit rester identique à vercel.json) : synchros seulement, pas de sauvegarde Drive. */
const DAY_SCHEDULE = "0 13 * * *";
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Appelé une fois par jour par Vercel Cron (voir vercel.json). Vercel envoie « Authorization: Bearer <CRON_SECRET> ». */
export async function GET(req: Request) {
  const t0 = Date.now();
  const secret = process.env.CRON_SECRET?.trim(), email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!secret || secret.length < 16 || !given || !same(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!email) return NextResponse.json({ error: "ALLOWED_EMAIL manquant" }, { status: 500 });
  try {
    const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: email.split("@")[0] } });

    // Les synchros tournent en même temps ; si l'une échoue, les autres continuent.
    // Programme de course → calendrier Intervals.icu (→ Garmin) pour les 14 prochains jours.
    const daytime = req.headers.get("x-vercel-cron-schedule") === DAY_SCHEDULE;
    const [intervals, googleFit, calendar] = await Promise.allSettled([
      syncIntervals(user.id, 3),
      syncGoogleFit(user.id, 3),
      syncProgramToIntervals(user.id, 14),
    ]);
    // Courses Strava APRÈS Google Fit : elles reprennent la ligne d'une même sortie détectée par Google Fit au lieu de la doubler.
    const [runs] = await Promise.allSettled([syncIntervalsRuns(user.id)]);

    if (runs.status === "fulfilled") { const r = runs.value; console.log(`[cron] courses Strava : ${r.found} activités, ${r.runs} courses, ${r.created} créées, ${r.replacedGoogleFit} remplaçant Google Fit, ${r.updated} mises à jour${r.errors.length ? `, erreurs : ${r.errors.join(" | ")}` : ""}`); }
    else console.error("[cron] courses Strava", runs.reason);

    // Heure affichée sous « Synchroniser maintenant » (feuille « + ») : la nuit compte aussi.
    if (intervals.status === "fulfilled" || runs.status === "fulfilled" || googleFit.status === "fulfilled") await prisma.user.update({ where: { id: user.id }, data: { lastSyncAt: new Date() } }).catch(() => {});

    const report = (r: PromiseSettledResult<unknown>) =>
      r.status === "fulfilled"
        ? { ok: true, result: r.value }
        : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };

    // Rattachement des activités du jour J aux courses : après les synchros, sans jamais les faire échouer.
    let races: { ok: boolean; linked?: number; error?: string };
    try {
      const linked = await matchRaceActivities(user.id);
      console.log(`[cron] courses rattachées : ${linked}`);
      races = { ok: true, linked };
    } catch (e) {
      console.error("[cron] rattachement des courses", e);
      races = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    // FC max estimée (sauf si saisie), puis rubans de zones en attente (jamais calculés, seuil changé, allure devenue FC) : autant que le budget de temps le permet (plus de nouvelle activité après 40 s), le reste à la nuit suivante.
    // Idempotent, et sans jamais faire échouer le cron. Avant les habitudes, qui ont leur propre échéance.
    let ribbons: { ok: boolean; hrMax?: unknown; backfill?: unknown; error?: string };
    try {
      const hrMax = await refreshHrMaxEstimate(user.id, { background: false });
      const backfill = await backfillRibbons(user.id, { limit: BACKFILL_CAP, deadline: t0 + RIBBON_BUDGET_MS });
      console.log(`[cron] FC max estimée ${hrMax.skipped ? "saisie, inchangée" : `${hrMax.after ?? "—"} bpm (${hrMax.source ?? "aucune donnée"})`} · rubans : ${backfill.examined} traités${backfill.timedOut ? " (budget de temps atteint, suite demain)" : ""}, ${backfill.ribbons} avec ruban, ${backfill.none} sans ruban, ${backfill.errors} en erreur`);
      ribbons = { ok: true, hrMax, backfill };
    } catch (e) {
      console.error("[cron] rubans de zones", e);
      ribbons = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }

    // Nouvelles traces GPS : habitudes recalculées (noms de lieux seulement s'il reste du temps), sans faire échouer le cron.
    let habits: { ok: boolean; error?: string } | undefined;
    const fresh = intervals.status === "fulfilled" && intervals.value.saved + intervals.value.backfilled > 0;
    if (fresh) {
      try { await buildAllHabits(user.id, t0 + 55_000); habits = { ok: true }; }
      catch (e) { console.error("[cron] habitudes", e); habits = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
    }

    // Sauvegarde de la muscu vers Google Drive : en dernier, à part, sans jamais faire échouer les synchros.
    let backup: { ok: boolean; date?: string; error?: string; skipped?: true } = { ok: true, skipped: true };
    if (!daytime) try {
      const b = await backupToDrive(user.id);
      console.log(`[cron] sauvegarde muscu ${b.date} : ${b.counts.activities} séances, ${b.deleted} ancien(s) fichier(s) supprimé(s)`);
      backup = { ok: true, date: b.date };
    } catch (e) {
      console.error("[cron] sauvegarde muscu", e);
      backup = { ok: false, error: e instanceof Error ? e.message : String(e) };
      const body = e instanceof DriveAuthError ? "Sauvegarde muscu échouée : reconnecte Google" : "Sauvegarde muscu échouée : réessaie depuis Vous › Réglages";
      await sendToUser(user.id, { title: "Pulse", body, url: "/vous", tag: "backup" }, { ttl: 6 * 3600, urgency: "normal" })
        .catch((err) => console.error("[cron] notification de sauvegarde", err));
    }

    const failed = intervals.status === "rejected" || runs.status === "rejected" || googleFit.status === "rejected" || calendar.status === "rejected";
    return NextResponse.json(
      { intervals: report(intervals), runs: report(runs), googleFit: report(googleFit), calendar: report(calendar), races, ribbons, habits, backup },
      { status: failed ? 502 : 200 }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 502 });
  }
}