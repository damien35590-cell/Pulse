import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyStreams, missingStreams, type IntervalsStream } from "@/lib/sync/intervals-streams";
import { parseIntervals, type IcuInterval } from "@/lib/training/reps";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Courbes des sorties Strava envoyées depuis Chrome par scripts/tampermonkey-intervals-streams.js
 * (Intervals.icu les refuse au serveur). Protégé par « Authorization: Bearer <PULSE_STREAM_SECRET> ».
 *   GET  → sorties récentes de Pulse sans trace : [{ externalId, startedAt, key }] (key : séance clé, découpage attendu)
 *   POST { externalId, streams, intervals? } → trace, altitude, cardio, records, VMA d'un test demi-Cooper ;
 *        intervals = réponse de /api/activity/{id}/intervals (séances clés) → répétitions du fractionné. Invalide : 400 « intervals… », rien d'écrit.
 */

const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Id de l'utilisateur autorisé, ou la réponse d'erreur à renvoyer. */
async function authorize(req: Request): Promise<{ uid: string } | { error: NextResponse }> {
  const secret = process.env.PULSE_STREAM_SECRET?.trim(), email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!secret || secret.length < 16 || !given || !same(given, secret)) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!email) return { error: NextResponse.json({ error: "ALLOWED_EMAIL manquant" }, { status: 500 }) };
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) return { error: NextResponse.json({ error: "utilisateur introuvable" }, { status: 404 }) };
  return { uid: user.id };
}

const MAX_POINTS = 50_000; // ~14 h à 1 Hz

/** Corps attendu : { externalId: string, streams: [{ type, data, data2? }], intervals?: { icu_intervals } } (réponses brutes d'Intervals). */
function parseBody(body: unknown): { externalId: string; streams: IntervalsStream[]; intervals: IcuInterval[] | null } | string {
  if (!body || typeof body !== "object") return "corps JSON attendu";
  const { externalId, streams, intervals } = body as { externalId?: unknown; streams?: unknown; intervals?: unknown };
  if (typeof externalId !== "string" || !/^[A-Za-z0-9_-]{1,40}$/.test(externalId)) return "externalId invalide";
  if (!Array.isArray(streams) || !streams.length) return "streams attendu (tableau non vide)";
  const out: IntervalsStream[] = [];
  for (const s of streams as unknown[]) {
    if (!s || typeof s !== "object") return "stream invalide";
    const { type, data, data2 } = s as { type?: unknown; data?: unknown; data2?: unknown };
    if (typeof type !== "string") return "stream sans type";
    if (data != null && (!Array.isArray(data) || data.length > MAX_POINTS)) return `stream ${type} : data invalide`;
    if (data2 != null && (!Array.isArray(data2) || data2.length > MAX_POINTS)) return `stream ${type} : data2 invalide`;
    out.push({ type, data: (data as IntervalsStream["data"]) ?? null, data2: (data2 as IntervalsStream["data2"]) ?? null });
  }
  if (!out.some((s) => s.type === "time")) return "stream « time » absent";
  const ivs = intervals == null ? null : parseIntervals(intervals);
  if (typeof ivs === "string") return ivs;
  return { externalId, streams: out, intervals: ivs };
}

export async function GET(req: Request) {
  try {
    const auth = await authorize(req);
    if ("error" in auth) return auth.error;
    return NextResponse.json({ missing: await missingStreams(auth.uid) });
  } catch (e) {
    console.error("[sync/streams] liste", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await authorize(req);
    if ("error" in auth) return auth.error;

    let body: unknown;
    try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
    const parsed = parseBody(body);
    if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });

    const res = await applyStreams(auth.uid, parsed.externalId, parsed.streams, parsed.intervals);
    if (!res) return NextResponse.json({ error: "sortie inconnue dans Pulse" }, { status: 404 });
    console.log(`[sync/streams] ${parsed.externalId} : ${res.points} points${res.gps ? ", trace GPS" : ""}, ${res.backfilled} ajout(s)${res.vma != null ? `, VMA ${res.vma} km/h` : ""}${res.reps != null ? `, ${res.reps} répétition(s)` : ""}`);
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    console.error("[sync/streams] réception", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 500 });
  }
}
