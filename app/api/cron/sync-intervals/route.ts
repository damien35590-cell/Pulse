import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncIntervals } from "@/lib/sync/intervals";
import { syncGoogleFit } from "@/lib/sync/google-fit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Appelé une fois par jour par Vercel Cron (voir vercel.json). Vercel envoie « Authorization: Bearer <CRON_SECRET> ». */
export async function GET(req: Request) {
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

    const failed = intervals.status === "rejected" || googleFit.status === "rejected";
    return NextResponse.json(
      { intervals: report(intervals), googleFit: report(googleFit) },
      { status: failed ? 502 : 200 }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 502 });
  }
}