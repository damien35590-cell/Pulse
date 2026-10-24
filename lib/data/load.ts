import { prisma } from "@/lib/prisma";
import { getZones } from "@/lib/data/zones";
import { computeLoad, sessionRpe, type LoadResult, type LoadZones } from "@/lib/load";
import type { StreamData } from "@/lib/stream";

/**
 * Calcule et enregistre la charge d'une activité, et sa charge ressentie (sRPE = RPE × minutes).
 * `zones` : à passer quand on traite plusieurs activités du même utilisateur.
 */
export async function refreshLoad(activityId: string, zones?: LoadZones): Promise<(LoadResult & { srpe: number | null }) | null> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { userId: true, type: true, movingTimeS: true, avgHr: true, avgPower: true, rpe: true, stream: { select: { data: true } } },
  });
  if (!a) return null;
  const st = (a.stream?.data ?? null) as StreamData | null;
  const r = computeLoad({ ...a, stream: st ? { power: st.power, hr: st.hr } : null }, zones ?? (await getZones(a.userId)));
  const srpe = sessionRpe(a.rpe, a.movingTimeS);
  await prisma.activity.update({ where: { id: activityId }, data: { load: r.load, loadSource: r.loadSource, srpe } });
  return { ...r, srpe };
}
