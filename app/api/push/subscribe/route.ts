import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fromB64u } from "@/lib/push/webpush";

export const dynamic = "force-dynamic";

type Body = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

/** Contrôle l'abonnement envoyé par le navigateur (PushSubscription.toJSON()). */
function parse(b: Body) {
  const endpoint = typeof b.endpoint === "string" ? b.endpoint : "", p256dh = typeof b.keys?.p256dh === "string" ? b.keys.p256dh : "", key = typeof b.keys?.auth === "string" ? b.keys.auth : "";
  try {
    if (new URL(endpoint).protocol !== "https:" || endpoint.length > 1024) return null;
    if (fromB64u(p256dh).length !== 65 || fromB64u(key).length !== 16) return null;
  } catch { return null; }
  return { endpoint, p256dh, auth: key };
}

/** Enregistre (ou rafraîchit) l'abonnement de cet appareil. */
export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sub = parse((await req.json().catch(() => ({}))) as Body);
  if (!sub) return NextResponse.json({ error: "Abonnement invalide" }, { status: 400 });
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: uid, p256dh: sub.p256dh, auth: sub.auth, userAgent },
    create: { userId: uid, ...sub, userAgent },
  });
  return NextResponse.json({ ok: true });
}

/** Désabonne cet appareil. */
export async function DELETE(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof endpoint === "string") await prisma.pushSubscription.deleteMany({ where: { userId: uid, endpoint } });
  return NextResponse.json({ ok: true });
}
