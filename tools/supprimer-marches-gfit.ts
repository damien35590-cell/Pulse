/**
 * Ménage : supprime les « marches » Google Fit de moins de 300 m (le téléphone qui bouge dans la poche), même seuil que la synchro
 * (lib/sync/google-fit-merge.ts, MIN_WALK_M). Seulement celles qui ne portent rien : ni ressenti, ni effort, ni notes, ni matériel,
 * ni photo, ni séance du programme, ni record.
 *
 *   npx tsx tools/supprimer-marches-gfit.ts            → simulation (par défaut)
 *   npx tsx tools/supprimer-marches-gfit.ts --apply    → supprime
 *
 * Base : DIRECT_URL du .env (dev). Pour la prod, voir CLAUDE.md.
 */
import { prisma } from "../lib/prisma";
import { MIN_WALK_M } from "../lib/sync/google-fit-merge";

const apply = process.argv.includes("--apply");

async function main() {
  const walks = await prisma.activity.findMany({
    where: {
      type: "WALK", distanceM: { lt: MIN_WALK_M },
      OR: [{ source: "google-fit" }, { dedupeKey: { startsWith: "gfit-" } }],
      feeling: null, rpe: null, notes: null, gear: { none: {} }, photos: { none: {} }, exercises: { none: {} }, plannedSession: { is: null },
    },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true, distanceM: true, movingTimeS: true },
  });
  const held = new Set((await prisma.personalRecord.findMany({ where: { activityId: { in: walks.map((w) => w.id) } }, select: { activityId: true } })).map((r) => r.activityId));
  const list = walks.filter((w) => !held.has(w.id));
  const km = list.reduce((s, w) => s + w.distanceM, 0) / 1000, h = list.reduce((s, w) => s + w.movingTimeS, 0) / 3600;
  const first = list[0]?.startedAt.toISOString().slice(0, 10), last = list.at(-1)?.startedAt.toISOString().slice(0, 10);
  console.log(`${apply ? "Suppression" : "Simulation (rien n'est écrit ; --apply pour supprimer)"} : ${list.length} marche(s) Google Fit de moins de ${MIN_WALK_M} m sans rien dessus, du ${first ?? "-"} au ${last ?? "-"} (${km.toFixed(2)} km, ${h.toFixed(1)} h en tout)${held.size ? ` ; ${held.size} gardée(s) car elles portent un record` : ""}.`);
  const byMonth = new Map<string, number>();
  for (const w of list) { const m = w.startedAt.toISOString().slice(0, 7); byMonth.set(m, (byMonth.get(m) ?? 0) + 1); }
  console.log([...byMonth].map(([m, n]) => `${m} : ${n}`).join(" · "));
  if (!apply || !list.length) return;
  const r = await prisma.activity.deleteMany({ where: { id: { in: list.map((w) => w.id) } } });
  console.log(`✓ ${r.count} supprimée(s).`);
}
main().finally(() => prisma.$disconnect());
