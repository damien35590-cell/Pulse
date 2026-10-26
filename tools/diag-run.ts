// Diagnostic lecture seule : la course du 20/10 et son insight.
import { prisma } from "../lib/prisma";
import { getActivityInsights } from "../lib/data/activity-insight";
async function main() {
  const acts = await prisma.activity.findMany({ where: { startedAt: { gte: new Date("2026-10-19T12:00:00Z"), lt: new Date("2026-10-22T00:00:00Z") } }, select: { id: true, userId: true, type: true, source: true, title: true, startedAt: true, distanceM: true, movingTimeS: true, avgHr: true, story: true, polyline: true, zoneRibbonSource: true, stream: { select: { activityId: true } } } });
  for (const a of acts) {
    const ins = (await getActivityInsights(a.userId, [a.id], "Europe/Paris", 190)).get(a.id);
    console.log(a.startedAt.toISOString(), a.type, a.source, a.title, a.distanceM, a.movingTimeS, "hr", a.avgHr, "poly", !!a.polyline, "stream", !!a.stream, "ribbon", a.zoneRibbonSource, "story", a.story, "insight", JSON.stringify(ins));
  }
}
main().finally(() => prisma.$disconnect());
