/**
 * Script ponctuel : calcule l'allure ajustée au dénivelé (Activity.gapPaceS, lib/run/gap.ts) des courses déjà en base.
 * Les nouvelles sorties la reçoivent à l'import (processActivity) ; ce script rattrape l'historique.
 *
 *   npx tsx tools/calculer-gap.ts --dry-run   → compte seulement ce qui serait écrit
 *   npx tsx tools/calculer-gap.ts             → écrit les valeurs manquantes ou changées
 *
 * Base : DIRECT_URL du .env, donc la branche Neon de dev. Pour la prod (voir CLAUDE.md), sans garder son adresse sur le disque :
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx tools/calculer-gap.ts --dry-run
 *   rm .env.production.local
 */
import { prisma } from "../lib/prisma";
import { gapIfHilly, type GapPoint } from "../lib/run/gap";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const runs = await prisma.activity.findMany({
    where: { type: "RUN", trackPoints: { not: undefined }, polyline: { not: null } },
    select: { id: true, distanceM: true, movingTimeS: true, elevationGainM: true, trackPoints: true, gapPaceS: true },
  });
  let set = 0, cleared = 0, same = 0, none = 0;
  for (const a of runs) {
    const gap = Array.isArray(a.trackPoints) ? gapIfHilly(a.trackPoints as GapPoint[], a) : null;
    const next = gap == null ? null : Math.round(gap * 10) / 10;
    if (next === a.gapPaceS) { if (next == null) none++; else same++; continue; }
    if (next == null) cleared++; else set++;
    if (!dryRun) await prisma.activity.update({ where: { id: a.id }, data: { gapPaceS: next } });
  }
  console.log(`${runs.length} courses avec trace : ${set} calculées, ${cleared} effacées, ${same} déjà à jour, ${none} sans allure ajustée (plat ou sans altitude)${dryRun ? " (simulation, rien écrit)" : ""}`);
}

main().finally(() => prisma.$disconnect());
