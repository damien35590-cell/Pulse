import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isSoftActivity } from "@/lib/sports";
import { buildTracesArt, MAX_TRACES, type TracesArt } from "@/lib/art/traces";

/** Sorties en plein air qui ont une trace (course, vélo y compris virtuel, rando) : ni marche ni vélotaf, comme les totaux de la page Vous. */
const OUTDOOR = { type: { in: ["RUN", "RIDE", "HIKE"] as ("RUN" | "RIDE" | "HIKE")[] }, polyline: { not: null } } as const;

/**
 * Art de la couverture « Toutes tes traces ». Le calcul (décodage, simplification, mise à l'échelle) est mis en cache par utilisateur ;
 * la clé contient le nombre de sorties et la dernière modification : un import, une suppression ou une édition la renouvelle, sans date d'expiration.
 */
export async function getTracesArt(userId: string): Promise<TracesArt> {
  const stamp = await prisma.activity.aggregate({ where: { userId, ...OUTDOOR }, _count: true, _max: { updatedAt: true } });
  if (!stamp._count) return { paths: [], hero: null, count: 0 };
  return unstable_cache(async () => {
    const rows = await prisma.activity.findMany({
      where: { userId, ...OUTDOOR },
      orderBy: { startedAt: "desc" },
      take: MAX_TRACES * 2, // marge : les vélotafs écartés ci-dessous ne doivent pas vider la liste
      select: { id: true, type: true, title: true, source: true, dedupeKey: true, startedAt: true, polyline: true },
    });
    const kept = rows.filter((r) => !isSoftActivity(r) && r.polyline).slice(0, MAX_TRACES);
    return buildTracesArt(kept.map((r) => ({ id: r.id, polyline: r.polyline!, startedAt: r.startedAt })));
  }, ["vous-traces", userId, String(stamp._count), String(+(stamp._max.updatedAt ?? 0))])();
}
