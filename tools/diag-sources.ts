// Diagnostic lecture seule : activités 2026 par source et type (nombre, km), avec le verdict isSoftActivity.
import { prisma } from "../lib/prisma";
import { isSoftActivity } from "../lib/sports";
async function main() {
  const all = await prisma.activity.findMany({ where: { startedAt: { gte: new Date("2026-01-01") } }, select: { type: true, source: true, title: true, dedupeKey: true, distanceM: true, movingTimeS: true } });
  const g = new Map<string, { n: number; km: number; soft: number }>();
  for (const a of all) { const k = `${a.source} / ${a.type}`, o = g.get(k) ?? { n: 0, km: 0, soft: 0 }; o.n++; o.km += a.distanceM / 1000; o.soft += isSoftActivity(a) ? 1 : 0; g.set(k, o); }
  for (const [k, o] of [...g].sort()) console.log(k.padEnd(24), String(o.n).padStart(4), o.km.toFixed(1).padStart(8), "km", " soft:", o.soft);
  const gf = all.filter((a) => a.source === "google-fit" && !isSoftActivity(a));
  console.log("google-fit NON soft:", gf.map((a) => `${a.type} "${a.title}" ${a.dedupeKey ?? "-"}`));
}
main().finally(() => prisma.$disconnect());
