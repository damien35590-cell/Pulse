import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseOne } from "@/lib/import";
import { saveActivities } from "@/lib/import/save";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const same = (a: string, b: string) => timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/** Réception d'un fichier FIT/GPX brut envoyé par le script du PC. Protégé par INGEST_TOKEN (pas de cookie). */
export async function POST(req: Request) {
  const token = process.env.INGEST_TOKEN?.trim(), email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length < 20 || !given || !same(given, token)) { await new Promise((r) => setTimeout(r, 500)); return NextResponse.json({ error: "unauthorized" }, { status: 401 }); }
  if (!email) return NextResponse.json({ error: "ALLOWED_EMAIL manquant" }, { status: 500 });

  const name = req.headers.get("x-filename") || "activite.fit";
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.length || bytes.length > 4_000_000) return NextResponse.json({ error: "taille invalide" }, { status: 400 });

  let activity;
  try { activity = await parseOne(name, bytes); }
  catch (e) { return NextResponse.json({ error: "Fichier illisible", detail: e instanceof Error ? e.message : "" }, { status: 422 }); }

  const user = await prisma.user.upsert({ where: { email }, update: {}, create: { email, name: email.split("@")[0] } });
  return NextResponse.json(await saveActivities(user.id, [activity]));
}
