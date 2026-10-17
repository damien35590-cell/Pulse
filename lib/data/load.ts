import { prisma } from "@/lib/prisma";
import { getZones } from "@/lib/data/zones";
import { computeLoad, type LoadResult, type LoadZones } from "@/lib/load";
import type { StreamData } from "@/lib/stream";

/** Calcule et enregistre la charge d'une activité. `zones` : à passer quand on traite plusieurs activités du même utilisateur. */
export async function refreshLoad(activityId: string, zones?: LoadZones): Promise<LoadResult | null> {
  const a = await prisma.activity.findUnique({
    where: { id: activityId },
    select: { userId: true, type: true, movingTimeS: true, avgHr: true, avgPower: true, rpe: true, stream: { select: { data: true } } },
  });
  if (!a) return null;
  const st = (a.stream?.data ?? null) as StreamData | null;
  const r = computeLoad({ ...a, stream: st ? { power: st.power, hr: st.hr } : null }, zones ?? (await getZones(a.userId)));
  await prisma.activity.update({ where: { id: activityId }, data: { load: r.load, loadSource: r.loadSource } });
  return r;
}
