import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendToUser } from "@/lib/push/send";
import { testMessage } from "@/lib/notify/content";

export const dynamic = "force-dynamic";

/** « Envoyer un test » : une notification tout de suite sur chaque appareil abonné. */
export async function POST() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await sendToUser(uid, testMessage(), { ttl: 120, urgency: "high" });
    return NextResponse.json(r, { status: r.total && !r.sent ? 502 : 200 });
  } catch (e) {
    console.error("[push] test", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Envoi impossible" }, { status: 500 });
  }
}
