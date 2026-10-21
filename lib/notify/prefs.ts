/** Réglages des notifications (une ligne NotificationPrefs par utilisateur ; tout est activé tant qu'il n'y en a pas). */
import { prisma } from "@/lib/prisma";

export type Prefs = { morning: boolean; reminder: boolean; weekly: boolean };
export const DEFAULT_PREFS: Prefs = { morning: true, reminder: true, weekly: true };

export async function getPrefs(userId: string): Promise<Prefs> {
  const p = await prisma.notificationPrefs.findUnique({ where: { userId } });
  return p ? { morning: p.morning, reminder: p.reminder, weekly: p.weekly } : DEFAULT_PREFS;
}
