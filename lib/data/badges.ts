import { prisma } from "@/lib/prisma";
import { BADGES, badgeItemFrom, buildBadgeStats, evaluateBadges, sortBadgeItems, type BadgeItem } from "@/lib/badges";

const TIER_NAMES = ["Bronze", "Argent", "Or", "Diamant"];

/** Activités, records et statistiques de badges d'un utilisateur (page profil et pipeline d'import). */
export async function loadBadgeStats(userId: string, tz: string) {
  const [acts, exercises, records, noted] = await Promise.all([
    prisma.activity.findMany({
      where: { userId },
      select: { type: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, avgPower: true, maxPower: true, weather: true, feeling: true },
    }),
    prisma.workoutExercise.findMany({ where: { activity: { userId } }, select: { activityId: true, name: true, sets: true, reps: true, loadKg: true } }),
    prisma.personalRecord.findMany({ where: { userId, type: "RUN" } }),
    prisma.activity.count({ where: { userId, AND: [{ notes: { not: null } }, { notes: { not: "" } }] } }),
  ]);
  const rec = Object.fromEntries(records.map((r) => [r.kind, r.value])) as Partial<Record<string, number>>;
  const stats = buildBadgeStats(acts, exercises, tz, { noted, best5kSec: rec.BEST_5K ?? null });
  return { acts, rec, stats };
}

/**
 * Enregistre dans UserBadge chaque palier atteint (identifiant « <badge>:<palier> ») pour garder sa date d'obtention.
 * L'affichage reste calculé à la volée par lib/badges.ts ; cette table ne sert que d'historique. Renvoie le nombre de nouveaux paliers.
 */
async function reachedTiers(userId: string, tz: string) {
  const { stats } = await loadBadgeStats(userId, tz);
  return evaluateBadges(stats).flatMap((b) => Array.from({ length: b.tier }, (_, i) => `${b.id}:${i + 1}`));
}

/** Après la suppression d'une activité : retire de l'historique les paliers qui ne sont plus atteints. Renvoie le nombre retiré. */
export async function revokeLostBadges(userId: string, tz: string) {
  const reached = await reachedTiers(userId, tz);
  return (await prisma.userBadge.deleteMany({ where: { userId, badgeId: { notIn: reached } } })).count;
}

export async function awardBadges(userId: string, tz: string) {
  const reached = await reachedTiers(userId, tz);
  if (!reached.length) return 0;
  await prisma.badge.createMany({
    data: BADGES.flatMap((b) => b.tiers.map((t, i) => ({ id: `${b.id}:${i + 1}`, name: `${b.name} (${TIER_NAMES[i]})`, description: `${b.desc} Palier : ${t} ${b.unit}.`, icon: b.icon }))),
    skipDuplicates: true,
  });
  const res = await prisma.userBadge.createMany({ data: reached.map((badgeId) => ({ userId, badgeId })), skipDuplicates: true });
  return res.count;
}

/** Tous les paliers obtenus (validés ou non), du plus ancien au plus récent. */
export async function getEarnedBadges(userId: string): Promise<BadgeItem[]> {
  const rows = await prisma.userBadge.findMany({ where: { userId }, select: { badgeId: true, earnedAt: true, acknowledgedAt: true } });
  return sortBadgeItems(rows.flatMap((r) => badgeItemFrom(r) ?? []));
}

/** Paliers obtenus mais pas encore validés, du plus ancien au plus récent (nom, critère, icône, date d'obtention). */
export async function getPendingBadges(userId: string): Promise<BadgeItem[]> {
  const rows = await prisma.userBadge.findMany({ where: { userId, acknowledgedAt: null }, select: { badgeId: true, earnedAt: true, acknowledgedAt: true } });
  return sortBadgeItems(rows.flatMap((r) => badgeItemFrom(r) ?? []));
}

/** Pastille de la barre du bas. Ne bloque jamais l'affichage : 0 en cas d'erreur. */
export async function countPendingBadges(userId: string): Promise<number> {
  return (await getPendingBadges(userId).catch((e) => { console.error("[badges] pending", e); return []; })).length;
}
