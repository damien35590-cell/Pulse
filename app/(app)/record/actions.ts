"use server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type PlusMenu = { nextSession: string | null; lastSyncAt: string | null };

/** Feuille « + » : prochaine séance du programme de muscu actif (« Haut du corps · Lafay ») et heure de la dernière synchro. */
export async function plusMenu(): Promise<PlusMenu> {
  const userId = (await auth())?.user?.id;
  if (!userId) throw new Error("Session expirée : reconnecte-toi.");
  const where: Prisma.PlannedSessionWhereInput = { userId, sport: "WORKOUT", status: "PLANNED", program: { status: "ACTIVE" } };
  const find = (w: Prisma.PlannedSessionWhereInput) =>
    prisma.plannedSession.findFirst({ where: w, orderBy: [{ date: "asc" }, { orderInWeek: "asc" }], select: { title: true, program: { select: { name: true } } } });
  const today = new Date(new Date().toISOString().slice(0, 10));
  const [user, next] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { lastSyncAt: true } }),
    // La plus proche à venir ; à défaut, la plus ancienne encore à faire (programme en retard).
    find({ ...where, date: { gte: today } }).then((s) => s ?? find(where)),
  ]);
  return { nextSession: next ? `${next.title} · ${next.program.name}` : null, lastSyncAt: user?.lastSyncAt?.toISOString() ?? null };
}
