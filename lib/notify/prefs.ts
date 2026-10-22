/** Réglages des notifications (une ligne NotificationPrefs par utilisateur ; tout est activé tant qu'il n'y en a pas). */
import { prisma } from "@/lib/prisma";

export type Prefs = { morning: boolean; reminder: boolean; weekly: boolean };
export type AllPrefs = Prefs & { morningCoachTime: string };
export const DEFAULT_PREFS: Prefs = { morning: true, reminder: true, weekly: true };
export const DEFAULT_MORNING_TIME = "06:00";

/** Heures proposables pour le coach du matin : 5 h 00 … 9 h 00 par pas de 15 min. */
export const MORNING_TIMES = Array.from({ length: 17 }, (_, k) => {
  const m = 5 * 60 + k * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export async function getPrefs(userId: string): Promise<AllPrefs> {
  const p = await prisma.notificationPrefs.findUnique({ where: { userId } });
  return p
    ? { morning: p.morning, reminder: p.reminder, weekly: p.weekly, morningCoachTime: p.morningCoachTime }
    : { ...DEFAULT_PREFS, morningCoachTime: DEFAULT_MORNING_TIME };
}
