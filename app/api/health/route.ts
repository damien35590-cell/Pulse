import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const redact = (s: string) => s.replace(/postgres(ql)?:\/\/\S+/gi, "[adresse]").replace(/at `[^`]+`/g, "at [hote]").slice(0, 400);

export async function GET() {
  const env = Object.fromEntries(["DATABASE_URL", "DIRECT_URL", "ALLOWED_EMAIL", "APP_PASSWORD", "NEXTAUTH_SECRET", "NEXTAUTH_URL"].map((k) => [k, (process.env[k] ?? "").trim().length > 0]));
  let db = "ok";
  try { await prisma.user.count(); } catch (e) { db = redact(String((e as Error)?.message ?? e)).split("\n").filter(Boolean).slice(-3).join(" | "); }
  return NextResponse.json({ env, passwordLength: (process.env.APP_PASSWORD ?? "").trim().length, db });
}
