// Diagnostic lecture seule : totaux 2026 de l'en-tête d'année, avant (tout) / après (hors activités douces), et phrases des 10 dernières muscu.
import { prisma } from "../lib/prisma";
import { isSoftActivity } from "../lib/sports";
import { getActivityInsights } from "../lib/data/activity-insight";
async function main() {
  const all = await prisma.activity.findMany({ where: { type: { in: ["WORKOUT", "RUN", "RIDE", "HIKE"] }, startedAt: { gte: new Date("2026-01-01") } }, select: { id: true, userId: true, type: true, title: true, source: true, dedupeKey: true, distanceM: true, movingTimeS: true } });
  const t = all.filter((a) => !isSoftActivity(a)), f = (l: typeof all) => `${l.length} · ${(l.reduce((s, a) => s + a.distanceM, 0) / 1000).toFixed(1)} km · ${(l.reduce((s, a) => s + a.movingTimeS, 0) / 3600).toFixed(1)} h`;
  console.log("2026 avant:", f(all), "| après:", f(t));
  const w = await prisma.activity.findMany({ where: { type: "WORKOUT" }, orderBy: { startedAt: "desc" }, take: 10, select: { id: true, userId: true, startedAt: true } });
  const ins = await getActivityInsights(w[0].userId, w.map((a) => a.id), "Europe/Paris", 190);
  for (const a of w) console.log(a.startedAt.toISOString().slice(0, 10), ins.get(a.id)?.strength?.text);
}
main().finally(() => prisma.$disconnect());
