import type { ActivityType, Gear } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultGear, wearLevel, type WearLevel } from "@/lib/gear";

export type GearUsage = Gear & { km: number; hours: number; count: number; level: WearLevel; pct: number | null };
type Use = { distanceM: number; movingTimeS: number; startedAt: Date; gear: { id: string }[] };

/**
 * Kilométrage de chaque matériel : km de départ + sorties qui lui sont affectées.
 * Un composant (chaîne, cassette…) compte les sorties de son support entre sa pose et son retrait.
 */
export function withUsage(gear: Gear[], acts: Use[]): GearUsage[] {
  return gear.map((g) => {
    const mine = acts.filter((a) => a.gear.some((x) => x.id === g.id) || (g.parentId != null && a.gear.some((x) => x.id === g.parentId) && a.startedAt >= g.installedAt && (!g.retiredAt || a.startedAt < g.retiredAt)));
    const km = g.startKm + mine.reduce((s, a) => s + a.distanceM, 0) / 1000;
    return { ...g, km, hours: mine.reduce((s, a) => s + a.movingTimeS, 0) / 3600, count: mine.length, level: wearLevel(km, g.limitKm), pct: g.limitKm ? km / g.limitKm : null };
  });
}

export async function getGear(userId: string) {
  const [gear, acts] = await Promise.all([
    prisma.gear.findMany({ where: { userId }, orderBy: [{ retiredAt: { sort: "desc", nulls: "first" } }, { createdAt: "asc" }] }),
    prisma.activity.findMany({ where: { userId, gear: { some: {} } }, select: { distanceM: true, movingTimeS: true, startedAt: true, gear: { select: { id: true } } } }),
  ]);
  return withUsage(gear, acts);
}

/** Matériel actif ayant atteint son seuil critique (composants compris). */
export async function gearAlerts(userId: string, onlyIds?: string[]) {
  const all = await getGear(userId);
  return all.filter((g) => !g.retiredAt && g.level !== "ok" && (!onlyIds || onlyIds.includes(g.id) || (g.parentId != null && onlyIds.includes(g.parentId))));
}

/** Ne garde que le matériel actif de l'utilisateur, hors composants (ceux-ci suivent leur support). */
export async function ownGearIds(userId: string, ids: unknown): Promise<string[]> {
  if (!Array.isArray(ids) || !ids.length) return [];
  const rows = await prisma.gear.findMany({ where: { userId, id: { in: ids.slice(0, 10).map(String) }, parentId: null, retiredAt: null }, select: { id: true } });
  return rows.map((r) => r.id);
}

/** Matériel par défaut pour une sortie importée : sans trace GPS, un vélo est supposé sur home trainer. */
export async function autoGearIds(userId: string, type: ActivityType, indoor: boolean): Promise<string[]> {
  const gear = await prisma.gear.findMany({ where: { userId, isDefault: true, retiredAt: null, parentId: null, sports: { has: type } } });
  const g = defaultGear(gear, type, indoor);
  return g ? [g.id] : [];
}
