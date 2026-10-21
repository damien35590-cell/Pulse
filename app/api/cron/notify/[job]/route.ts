import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runNotify } from "@/lib/notify/run";
import { parseJob } from "@/lib/notify/schedule";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/**
 * Notifications planifiées (voir vercel.json et lib/notify/schedule.ts) : /api/cron/notify/matin | rappel-HH | bilan.
 * Même protection que la synchro : « Authorization: Bearer <CRON_SECRET> », envoyé par Vercel Cron.
 * `?force=1` (appel manuel avec le secret) : ignore le jour de la semaine et le « déjà envoyé aujourd'hui ».
 */
export async function GET(req: Request, { params }: { params: { job: string } }) {
  const secret = process.env.CRON_SECRET?.trim(), email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!secret || secret.length < 16 || !given || !same(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!email) return NextResponse.json({ error: "ALLOWED_EMAIL manquant" }, { status: 500 });
  const job = parseJob(params.job);
  if (!job) return NextResponse.json({ error: "tâche inconnue" }, { status: 404 });
  try {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return NextResponse.json({ job: job.job, status: "skipped", reason: "utilisateur inconnu" });
    const force = new URL(req.url).searchParams.get("force") === "1";
    const r = await runNotify(user.id, job.kind, new Date(), force);
    console.log(`[notify] ${job.job} → ${r.status}${r.reason ? ` (${r.reason})` : ""}${r.title ? ` : ${r.title}` : ""}`);
    return NextResponse.json({ job: job.job, ...r }, { status: r.status === "failed" ? 502 : 200 });
  } catch (e) {
    console.error(`[notify] ${job.job}`, e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 502 });
  }
}
