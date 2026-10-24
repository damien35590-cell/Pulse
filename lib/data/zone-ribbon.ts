import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getZones } from "@/lib/data/zones";
import { zoneRibbon, type RibbonSegment } from "@/lib/art/zone-ribbon";
import { buildStream, type StreamData } from "@/lib/stream";
import type { TrackPoint } from "@/lib/import/types";

/** Seuils nécessaires au ruban (même source que la fiche : getZones). */
export type RibbonZones = { hrMax: number | null; ftp: number | null };

/**
 * Ruban de zones d'une activité, calculé à partir de sa série à 1 Hz ; à défaut de série (séance d'avant l'arrivée des séries),
 * à partir de la trace compactée, comme la fiche pour la FC. Null sans FC ni puissance, ou sans seuil. N'écrit rien.
 * `zones` : à passer quand on traite plusieurs activités du même utilisateur.
 */
export async function computeZoneRibbon(activityId: string, zones?: RibbonZones): Promise<RibbonSegment[] | null> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: { userId: true, type: true, stream: { select: { data: true } } } });
  if (!a) return null;
  let st = (a.stream?.data ?? null) as StreamData | null;
  if (!st) {
    const t = await prisma.activity.findUnique({ where: { id: activityId }, select: { trackPoints: true } });
    st = Array.isArray(t?.trackPoints) ? buildStream(t.trackPoints as unknown as TrackPoint[]) : null;
  }
  if (!st) return null;
  return zoneRibbon(st, zones ?? (await getZones(a.userId)), { ride: a.type === "RIDE" || a.type === "EBIKE" });
}

/** Calcule et enregistre Activity.zoneRibbon (null quand il n'y a pas de ruban). Renvoie le nombre de tronçons (0 = pas de ruban). */
export async function refreshZoneRibbon(activityId: string, zones?: RibbonZones): Promise<number> {
  const ribbon = await computeZoneRibbon(activityId, zones);
  await prisma.activity.update({ where: { id: activityId }, data: { zoneRibbon: ribbon ?? Prisma.DbNull } });
  return ribbon?.length ?? 0;
}
