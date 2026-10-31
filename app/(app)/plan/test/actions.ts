"use server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { applyLafayTest, saveLafayTest, type AppliedChange } from "@/lib/data/lafay-test";

async function userId() {
  const id = (await auth())?.user?.id;
  if (!id) throw new Error("Session expirée : reconnecte-toi.");
  return id;
}

/** Test terminé : enregistré à part des séances (LafayTest), jamais dans le fil ni les totaux. */
export async function saveTest(body: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const id = await saveLafayTest(await userId(), body).catch(() => null);
  if (!id) return { ok: false, error: "Impossible d’enregistrer le test : tes valeurs sont gardées, réessaie." };
  revalidatePath("/plan"); revalidatePath("/plan/test");
  return { ok: true, id };
}

/** « Appliquer à mon programme », après confirmation : seulement la ligne de dips du modèle « Haut du corps ». */
export async function applyTest(id: string): Promise<{ ok: true; change: AppliedChange } | { ok: false; error: string }> {
  const change = await applyLafayTest(await userId(), id).catch(() => null);
  if (!change) return { ok: false, error: "Impossible d’appliquer ce test : réessaie." };
  revalidatePath("/plan"); revalidatePath(`/plan/test/${id}`); revalidatePath("/plan/test");
  return { ok: true, change };
}
