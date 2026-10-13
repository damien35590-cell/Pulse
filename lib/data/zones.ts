import { prisma } from "@/lib/prisma";
import { bestCurve, estimateFtp } from "@/lib/power";

/** Seuils : valeurs saisies, sinon estimées (FTP = 95 % du meilleur 20 min ; FC max = plus haute FC enregistrée). */
export async function getZones(userId: string) {
  const [z, curves, hr] = await Promise.all([
    prisma.userZones.findUnique({ where: { userId } }),
    prisma.activityStream.findMany({ where: { activity: { userId } }, select: { curve: true } }),
    prisma.activity.aggregate({ where: { userId, maxHr: { not: null } }, _max: { maxHr: true } }),
  ]);
  const ftpAuto = estimateFtp(bestCurve(curves.map((c) => c.curve as (number | null)[] | null))), hrAuto = hr._max.maxHr ?? null;
  return { ftp: z?.ftp ?? ftpAuto, hrMax: z?.hrMax ?? hrAuto, ftpAuto, hrAuto, ftpManual: z?.ftp != null, hrManual: z?.hrMax != null };
}
