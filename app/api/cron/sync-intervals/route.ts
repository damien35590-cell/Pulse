import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncIntervals } from "@/lib/sync/intervals";
import { syncGoogleFit } from "@/lib/sync/google-fit";
import { matchRaceActivities } from "@/lib/races/link";
import { buildAllHabits } from "@/lib/habits/build";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
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

    // Les deux synchros tournent en même temps ; si l'une échoue, l'autre continue.
    const [intervals, googleFit] = await Promise.allSettled([
      syncIntervals(user.id, 3),
      syncGoogleFit(user.id, 3),
    ]);

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

    // Nouvelles traces GPS : habitudes recalculées (noms de lieux seulement s'il reste du temps), sans faire échouer le cron.
    let habits: { ok: boolean; error?: string } | undefined;
    const fresh = intervals.status === "fulfilled" && intervals.value.saved + intervals.value.backfilled > 0;
    if (fresh) {
      try { await buildAllHabits(user.id, t0 + 55_000); habits = { ok: true }; }
      catch (e) { console.error("[cron] habitudes", e); habits = { ok: false, error: e instanceof Error ? e.message : String(e) }; }
    }

    const failed = intervals.status === "rejected" || googleFit.status === "rejected";
    return NextResponse.json(
      { intervals: report(intervals), googleFit: report(googleFit), races, habits },
      { status: failed ? 502 : 200 }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 502 });
  }
}