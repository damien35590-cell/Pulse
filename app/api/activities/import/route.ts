import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { saveActivities } from "@/lib/import/save";
import type { ParsedActivity } from "@/lib/import/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const raw: ParsedActivity[] = Array.isArray(body?.activities) ? body.activities.slice(0, 10) : [];
  return NextResponse.json(await saveActivities(uid, raw));
}
