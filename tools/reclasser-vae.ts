/**
 * Script ponctuel : passe en EBIKE (vélotaf) les sorties vélo importées depuis Google Fit et déjà en base en RIDE.
 *
 *   npx tsx tools/reclasser-vae.ts            → applique
 *   npx tsx tools/reclasser-vae.ts --dry-run  → affiche seulement ce qui changerait
 *
 * Google Fit enregistrait ses activités avec la source « fit » (comme les fichiers FIT) : on les reconnaît
 * à leur dedupeKey « gfit-… ». Le script leur donne au passage la source « google-fit ».
 * Prisma lit DIRECT_URL dans le fichier .env à la racine du projet.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const where = {
    type: "RIDE" as const,
    OR: [{ source: "google-fit" }, { dedupeKey: { startsWith: "gfit-" } }],
  };
  const rows = await prisma.activity.findMany({ where, select: { id: true, startedAt: true, title: true, distanceM: true }, orderBy: { startedAt: "asc" } });
  console.log(`${rows.length} sortie(s) Google Fit en RIDE à passer en EBIKE.`);
  for (const r of rows) console.log(`  ${r.startedAt.toISOString().slice(0, 16).replace("T", " ")}  ${(r.distanceM / 1000).toFixed(1)} km  ${r.title}`);
  if (dryRun || !rows.length) { if (dryRun) console.log("Simulation : rien n'a été modifié."); return; }

  const ids = rows.map((r) => r.id);
  const [updated, records] = await prisma.$transaction([
    prisma.activity.updateMany({ where: { id: { in: ids } }, data: { type: "EBIKE", source: "google-fit" } }),
    // Un E-bike n'établit pas de record vélo : on retire ceux que ces sorties détiendraient.
    prisma.personalRecord.deleteMany({ where: { type: "RIDE", activityId: { in: ids } } }),
  ]);
  console.log(`${updated.count} sortie(s) reclassée(s) en EBIKE, ${records.count} record(s) vélo retiré(s).`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
