import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getVapidKeys } from "@/lib/push/vapid";

export const dynamic = "force-dynamic";

/** Clé publique VAPID (applicationServerKey du navigateur). Générée et stockée en base au premier appel si l'environnement n'en fournit pas. */
export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { publicKey } = await getVapidKeys();
    return NextResponse.json({ publicKey });
  } catch (e) {
    console.error("[push] clé VAPID", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Clé de notification indisponible" }, { status: 500 });
  }
}
