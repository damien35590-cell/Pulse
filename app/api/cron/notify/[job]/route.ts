import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runNotify } from "@/lib/notify/run";
import { morningCanRetry, parseJob } from "@/lib/notify/schedule";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
/** Base Neon en veille ou connexion coupée : vaut la peine de réessayer une fois (P1001 injoignable, P1002/P1008 délai, P1017 fermée). */
// Codes de coupure du pilote pg : réseau (Node) et SQLSTATE classe 08 / arrêt serveur / trop de connexions.
// Depuis l'adaptateur pg, une panne de connexion remonte du pilote et plus du moteur Rust : les codes
// P100x ne sont plus émis, d'où ce second filet pour garder le même réessai.
const PG_TRANSIENT = new Set([
  "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE", "EHOSTUNREACH", "EAI_AGAIN",
  "08000", "08003", "08006", "08001", "08004", "57P01", "57P02", "57P03", "53300",
]);
function transientDb(e: unknown): boolean {
  if (e instanceof Prisma.PrismaClientInitializationError) return true;
  if (e instanceof Prisma.PrismaClientKnownRequestError) return ["P1001", "P1002", "P1008", "P1017", "P2024"].includes(e.code);
  const code = (e as { code?: unknown } | null)?.code;
  if (typeof code === "string" && PG_TRANSIENT.has(code)) return true;
  if (e instanceof Error && /can't reach database|connection|timed out|ECONNRESET|terminating connection|server closed|socket hang up/i.test(e.message)) return true;
  // Prisma emballe l'erreur du pilote : on suit la cause.
  const cause = (e as { cause?: unknown } | null)?.cause;
  return cause != null && cause !== e ? transientDb(cause) : false;
}
async function withRetry<T>(f: () => Promise<T>): Promise<T> {
  try { return await f(); }
  catch (e) {
    if (!transientDb(e)) throw e;
    console.warn("[notify] base injoignable, nouvel essai dans 3 s", e instanceof Error ? e.message : e);
    await new Promise((r) => setTimeout(r, 3000));
    return f();
  }
}
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/**
 * Notifications planifiées (voir vercel.json et lib/notify/schedule.ts) : /api/cron/notify/matin | rappel-HH | bilan.
 * Le coach du matin est appelé toutes les 15 min par cron-job.org (GET ou POST) et répond { sent, reason }.
 * Même protection que la synchro : « Authorization: Bearer <CRON_SECRET> », envoyé par Vercel Cron.
 * `?force=1` (appel manuel avec le secret) : ignore le jour de la semaine et le « déjà envoyé aujourd'hui ».
 * Coach du matin : un échec avant 9 h 30 répond 200 (sent: false) car le passage suivant, 15 min plus tard, réessaie
 * (le journal n'est écrit qu'après un envoi réussi) ; seul un échec sans rattrapage possible répond 502 (mail de cron-job.org).
 */
async function handle(req: Request, { params }: { params: { job: string } }) {
  const secret = process.env.CRON_SECRET?.trim(), email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!secret || secret.length < 16 || !given || !same(given, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!email) return NextResponse.json({ error: "ALLOWED_EMAIL manquant" }, { status: 500 });
  const job = parseJob(params.job);
  if (!job) return NextResponse.json({ error: "tâche inconnue" }, { status: 404 });
  const morning = job.kind === "morning";
  // Statut d'un échec : 502 sauf pour le coach du matin tant qu'un passage suivant peut réessayer.
  const failStatus = () => (morning && morningCanRetry(new Date(), "Europe/Paris") ? 200 : 502);
  try {
    const user = await withRetry(() => prisma.user.findUnique({ where: { email }, select: { id: true } }));
    if (!user) return NextResponse.json({ job: job.job, status: "skipped", reason: "utilisateur inconnu" });
    const force = new URL(req.url).searchParams.get("force") === "1";
    const r = await withRetry(() => runNotify(user.id, job.kind, new Date(), force));
    const line = `[notify] ${job.job} → ${r.status}${r.reason ? ` (${r.reason})` : ""}${r.title ? ` : ${r.title}` : ""}${r.errors ? ` ${r.errors.join(" | ")}` : ""}`;
    if (r.status === "failed") console.error(line); else console.log(line);
    const status = r.status === "failed" ? failStatus() : 200;
    if (morning) return NextResponse.json({ sent: r.status === "sent", reason: r.reason ?? (r.status === "sent" ? "envoyé" : r.errors?.[0] ?? "échec de l'envoi"), ...(r.status === "failed" && status === 200 ? { retry: "au prochain passage" } : {}) }, { status });
    return NextResponse.json({ job: job.job, ...r }, { status });
  } catch (e) {
    console.error(`[notify] ${job.job}`, e);
    const status = failStatus();
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur", ...(status === 200 ? { sent: false, retry: "au prochain passage" } : {}) }, { status });
  }
}

export { handle as GET, handle as POST };
