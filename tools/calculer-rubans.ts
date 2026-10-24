/**
 * Script ponctuel : calcule le ruban de zones (Activity.zoneRibbon, lib/art/zone-ribbon.ts) des activités déjà en base.
 *
 *   npx tsx tools/calculer-rubans.ts --dry-run   → compte seulement ce qui serait écrit
 *   npx tsx tools/calculer-rubans.ts             → applique (activités sans ruban uniquement)
 *   npx tsx tools/calculer-rubans.ts --all       → recalcule aussi celles qui en ont déjà un
 *
 * À relancer avec --all après un changement de FC max ou de FTP dans l'onglet Vous : les rubans déjà stockés ne bougent pas seuls.
 * Les seuils utilisés sont ceux d'aujourd'hui (saisis, sinon estimés), appliqués à toutes les dates.
 * Base : DIRECT_URL du .env, donc la branche Neon de dev. Pour la prod (voir CLAUDE.md), sans garder son adresse sur le disque :
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx tools/calculer-rubans.ts --dry-run
 *   rm .env.production.local
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getZones } from "../lib/data/zones";
import { computeZoneRibbon } from "../lib/data/zone-ribbon";

const dryRun = process.argv.includes("--dry-run"), all = process.argv.includes("--all");

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const total = { seen: 0, ribbon: 0, none: 0 }, bySource = new Map<string, number>(), byType = new Map<string, number>();
  for (const u of users) {
    const ids = await prisma.activity.findMany({
      where: { userId: u.id, ...(all ? {} : { zoneRibbon: { equals: Prisma.DbNull } }) },
      select: { id: true, type: true, source: true }, orderBy: { startedAt: "asc" },
    });
    if (!ids.length) continue;
    const zones = await getZones(u.id);
    console.log(`\n${u.email ?? u.id} : ${ids.length} activité(s) à examiner, FC max ${zones.hrMax ?? "inconnue"} bpm, FTP ${zones.ftp ?? "inconnue"} W`);
    // Une activité à la fois : les séries 1 Hz sont volumineuses.
    for (const { id, type, source } of ids) {
      total.seen++;
      const ribbon = await computeZoneRibbon(id, zones);
      if (!ribbon) {
        total.none++;
        if (all && !dryRun) await prisma.activity.update({ where: { id }, data: { zoneRibbon: Prisma.DbNull } }); // un ruban périmé (seuils retirés) ne doit pas survivre
        continue;
      }
      total.ribbon++;
      bySource.set(source, (bySource.get(source) ?? 0) + 1);
      byType.set(type, (byType.get(type) ?? 0) + 1);
      if (!dryRun) await prisma.activity.update({ where: { id }, data: { zoneRibbon: ribbon as unknown as Prisma.InputJsonValue } });
    }
  }
  const fmt = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "aucun";
  console.log(`\n${total.seen} activité(s) examinée(s) : ${total.ribbon} ${dryRun ? "recevraient" : "ont reçu"} un ruban, ${total.none} sans FC ni puissance exploitable (restent à null).`);
  console.log(`Par source : ${fmt(bySource)}`);
  console.log(`Par type   : ${fmt(byType)}`);
  if (dryRun) console.log("\nSimulation : rien n'a été modifié.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
