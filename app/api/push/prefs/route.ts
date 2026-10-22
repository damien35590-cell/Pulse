import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PREFS, getPrefs, MORNING_TIMES, type Prefs } from "@/lib/notify/prefs";

export const dynamic = "force-dynamic";

export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await getPrefs(uid));
}

/** Active / coupe un type de notification : { morning?, reminder?, weekly?: boolean, morningCoachTime?: "HH:mm" (05:00 … 09:00, pas de 15 min) }. */
export async function PATCH(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Partial<Prefs> = {};
  for (const k of Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]) if (typeof body[k] === "boolean") data[k] = body[k] as boolean;
  const time = typeof body.morningCoachTime === "string" && MORNING_TIMES.includes(body.morningCoachTime) ? body.morningCoachTime : undefined;
  if (!Object.keys(data).length && !time) return NextResponse.json({ error: "Rien à changer" }, { status: 400 });
  const change = time ? { ...data, morningCoachTime: time } : data;
  const p = await prisma.notificationPrefs.upsert({ where: { userId: uid }, update: change, create: { userId: uid, ...DEFAULT_PREFS, ...change } });
  return NextResponse.json({ morning: p.morning, reminder: p.reminder, weekly: p.weekly, morningCoachTime: p.morningCoachTime });
}
