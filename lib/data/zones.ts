import { prisma } from "@/lib/prisma";
import { bestCurve, estimateFtp } from "@/lib/power";

/**
 * Seuils : valeurs saisies, sinon estimées (FTP = 95 % du meilleur 20 min ; FC max = estimation de lib/physio/hr-max.ts, rafraîchie chaque nuit).
 * `ftp` / `hrMax` : la valeur à utiliser ; `*Auto` : l'estimation ; `*Manual` : vrai si la valeur utilisée est une saisie.
 */
export async function getZones(userId: string) {
  const [z, curves] = await Promise.all([
    prisma.userZones.findUnique({ where: { userId } }),
    prisma.activityStream.findMany({ where: { activity: { userId } }, select: { curve: true } }),
  ]);
  const ftpAuto = estimateFtp(bestCurve(curves.map((c) => c.curve as (number | null)[] | null))), hrAuto = z?.hrMaxEstimate ?? null;
  return { ftp: z?.ftp ?? ftpAuto, hrMax: z?.hrMax ?? hrAuto, ftpAuto, hrAuto, ftpManual: z?.ftp != null, hrManual: z?.hrMax != null };
}
