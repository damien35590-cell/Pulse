/**
 * Réécrit les anciennes phrases de série stockées dans Activity.story (« 16ème sortie de suite. La régularité commence à payer. »)
 * avec le générateur sobre de lib/coach/streak-line.ts. Idempotent : le numéro de série est relu dans la phrase, la variante vient de l'id.
 * Usage : node --env-file=.env --import tsx tools/regenerer-phrases-serie.ts [--dry-run]   (base du .env = dev ; prod : voir CLAUDE.md)
 */
import { prisma } from "../lib/prisma";
import { streakLine, streakNumber } from "../lib/coach/streak-line";

const DRY = process.argv.includes("--dry-run");

async function main() {
  const rows = await prisma.activity.findMany({
    where: { OR: [{ story: { contains: "de suite" } }, { story: { contains: "consécutive" } }, { story: { contains: "d'affilée" } }, { story: { startsWith: "Série en cours" } }] },
    select: { id: true, type: true, story: true, distanceM: true, movingTimeS: true, elevationGainM: true },
    orderBy: { startedAt: "desc" },
  });
  const todo = rows.flatMap((r) => {
    const n = r.story ? streakNumber(r.story) : null;
    if (n == null) return [];
    const next = streakLine({ id: r.id, type: r.type, n, distanceM: r.distanceM, movingTimeS: r.movingTimeS, elevationGainM: r.elevationGainM });
    return next === r.story ? [] : [{ id: r.id, type: r.type, before: r.story!, next }];
  });
  console.log(`${rows.length} phrases de série, ${todo.length} à réécrire${DRY ? " (dry-run)" : ""}`);
  for (const t of todo.slice(0, 10)) console.log(`${t.type.padEnd(7)} ${t.id.slice(0, 8)}\n  avant : ${t.before}\n  après : ${t.next}`);
  if (!DRY) for (const t of todo) await prisma.activity.update({ where: { id: t.id }, data: { story: t.next } });
  await prisma.$disconnect();
}
main();
