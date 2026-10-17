import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncIntervals } from "@/lib/sync/intervals";
import { matchRaceActivities } from "@/lib/races/link";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** Bouton « Synchroniser maintenant » (connecté). */
export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const days = Math.min(30, Math.max(1, Number(body?.days) || 7));
  try {
    const res = await syncIntervals(uid, days);
    const racesLinked = await matchRaceActivities(uid).catch(() => 0);
    return NextResponse.json({ ...res, racesLinked });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 502 }); }
}
