/** Réglages des notifications (une ligne NotificationPrefs par utilisateur ; tout est activé tant qu'il n'y en a pas). */
import { prisma } from "@/lib/prisma";
import { DEFAULT_MORNING_TIME, DEFAULT_PREFS, type AllPrefs } from "@/lib/notify/prefs-shared";

// Types et constantes vivent dans prefs-shared.ts (importable côté client) ; réexportés ici pour les appelants serveur.
export { DEFAULT_MORNING_TIME, DEFAULT_PREFS, MORNING_TIMES } from "@/lib/notify/prefs-shared";
export type { AllPrefs, Prefs } from "@/lib/notify/prefs-shared";

export async function getPrefs(userId: string): Promise<AllPrefs> {
  const p = await prisma.notificationPrefs.findUnique({ where: { userId } });
  return p
    ? { morning: p.morning, reminder: p.reminder, weekly: p.weekly, morningCoachTime: p.morningCoachTime }
    : { ...DEFAULT_PREFS, morningCoachTime: DEFAULT_MORNING_TIME };
}
