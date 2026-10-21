import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { buildAllHabits } from "@/lib/habits/build";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const BUDGET_MS = 50_000;

/** Recalcule tes habitudes (course et vélo) : carte de chaleur, classiques, bifurcations. */
export async function POST() {
  const t0 = Date.now();
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const res = await buildAllHabits(uid, t0 + BUDGET_MS);
    revalidatePath("/itineraires"); revalidatePath("/itineraires/habitudes");
    return NextResponse.json(res);
  } catch (e) {
    console.error("[habits/build]", e);
    return NextResponse.json({ error: "Le calcul des habitudes a échoué." }, { status: 500 });
  }
}
