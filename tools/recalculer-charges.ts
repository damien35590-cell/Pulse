/**
 * Script ponctuel : calcule la charge d'entraînement (load + loadSource, voir lib/load.ts) de tout l'historique.
 *
 *   npx tsx tools/recalculer-charges.ts            → applique
 *   npx tsx tools/recalculer-charges.ts --dry-run  → affiche seulement la répartition obtenue
 *
 * À relancer après un changement de FTP ou de FC max dans l'onglet Vous : les charges déjà stockées ne bougent pas seules.
 * Les seuils utilisés sont ceux d'aujourd'hui (saisis, sinon estimés), appliqués à toutes les dates.
 * Base : DIRECT_URL du .env, donc la branche Neon de dev. Pour la prod (voir CLAUDE.md), sans garder son adresse sur le disque :
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx tools/recalculer-charges.ts --dry-run
 *   rm .env.production.local
 */
import { prisma } from "../lib/prisma";
import { getZones } from "../lib/data/zones";
import { computeLoad, LOAD_SOURCES, type LoadSource } from "../lib/load";
import type { StreamData } from "../lib/stream";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  for (const u of users) {
    const zones = await getZones(u.id);
    const ids = await prisma.activity.findMany({ where: { userId: u.id }, select: { id: true }, orderBy: { startedAt: "asc" } });
    if (!ids.length) continue;
    console.log(`\n${u.email ?? u.id} : ${ids.length} activité(s), FTP ${zones.ftp ?? "inconnue"} W, FC max ${zones.hrMax ?? "inconnue"} bpm`);
    const count: Record<LoadSource, number> = { power: 0, hr: 0, rpe: 0, estimate: 0 }, sum: Record<LoadSource, number> = { power: 0, hr: 0, rpe: 0, estimate: 0 };
    let changed = 0;
    // Une activité à la fois : les séries 1 Hz sont volumineuses.
    for (const { id } of ids) {
      const a = await prisma.activity.findUnique({
        where: { id },
        select: { type: true, movingTimeS: true, avgHr: true, avgPower: true, rpe: true, load: true, loadSource: true, stream: { select: { data: true } } },
      });
      if (!a) continue;
      const st = (a.stream?.data ?? null) as StreamData | null;
      const r = computeLoad({ ...a, stream: st ? { power: st.power, hr: st.hr } : null }, zones);
      count[r.loadSource]++; sum[r.loadSource] += r.load;
      if (r.load === a.load && r.loadSource === a.loadSource) continue;
      changed++;
      if (!dryRun) await prisma.activity.update({ where: { id }, data: { load: r.load, loadSource: r.loadSource } });
    }
    for (const s of LOAD_SOURCES) if (count[s]) console.log(`  ${s.padEnd(8)} ${String(count[s]).padStart(5)} activité(s), charge moyenne ${(sum[s] / count[s]).toFixed(0)}`);
    console.log(`  ${changed} activité(s) ${dryRun ? "à mettre à jour" : "mise(s) à jour"}.`);
  }
  if (dryRun) console.log("\nSimulation : rien n'a été modifié.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
