"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextSessionSuggestion } from "@/lib/workout/queries";
import { suggestionLabel } from "@/lib/workout/kind";

export type PlusMenu = { nextSession: string | null; lastSyncAt: string | null };

/** Feuille « + » : séance suggérée du jour (la même que l'écran de préparation, « Haut du corps · Lafay ») et heure de la dernière synchro. */
export async function plusMenu(): Promise<PlusMenu> {
  const userId = (await auth())?.user?.id;
  if (!userId) throw new Error("Session expirée : reconnecte-toi.");
  const [user, suggestion] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { lastSyncAt: true } }),
    getNextSessionSuggestion(userId),
  ]);
  return { nextSession: suggestionLabel(suggestion), lastSyncAt: user?.lastSyncAt?.toISOString() ?? null };
}
