import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncGoogleFit } from "@/lib/sync/google-fit";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  
  const body = await req.json().catch(() => ({}));
  const days = Math.min(30, Math.max(1, Number(body?.days) || 7));
  
  try { 
    return NextResponse.json(await syncGoogleFit(uid, days)); 
  } catch (e) { 
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 502 }); 
  }
}