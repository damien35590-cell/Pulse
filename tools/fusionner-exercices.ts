/**
 * Script ponctuel : unifie les noms d'exercices en doublon (« Pompes », « pompe », « POMPES »…).
 *
 *   npx tsx tools/fusionner-exercices.ts            → applique
 *   npx tsx tools/fusionner-exercices.ts --dry-run  → affiche seulement ce qui changerait
 *
 * Deux noms sont les mêmes s'ils ont la même clé (sans accents, majuscules ni pluriel, cf. lib/exercises.ts).
 * Le nom conservé est l'orthographe la plus fréquente, à égalité la plus récente. Seul le champ name est modifié.
 * Base : DIRECT_URL du .env, donc la branche Neon de dev. Pour la prod (voir CLAUDE.md), sans garder son adresse sur le disque :
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx tools/fusionner-exercices.ts --dry-run
 *   rm .env.production.local
 */
import { PrismaClient } from "@prisma/client";
import { exerciseKey } from "../lib/exercises";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

async function main() {
  const rows = await prisma.workoutExercise.findMany({ select: { name: true, activity: { select: { startedAt: true } } } });
  const groups = new Map<string, Map<string, { n: number; last: number }>>();
  for (const r of rows) {
    const key = exerciseKey(r.name);
    if (!key) continue;
    const spell = groups.get(key) ?? new Map();
    const s = spell.get(r.name) ?? { n: 0, last: 0 };
    spell.set(r.name, { n: s.n + 1, last: Math.max(s.last, +r.activity.startedAt) });
    groups.set(key, spell);
  }

  const renames: [from: string, to: string, n: number][] = [];
  for (const spell of groups.values()) {
    if (spell.size < 2) continue;
    const [keep] = [...spell.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last - a[1].last)[0];
    for (const [name, { n }] of spell) if (name !== keep) renames.push([name, keep, n]);
  }
  console.log(`${renames.length} orthographe(s) à unifier.`);
  for (const [from, to, n] of renames) console.log(`  « ${from} » → « ${to} »  (${n} ligne${n > 1 ? "s" : ""})`);
  if (dryRun || !renames.length) { if (dryRun) console.log("Simulation : rien n'a été modifié."); return; }

  const done = await prisma.$transaction(renames.map(([from, to]) => prisma.workoutExercise.updateMany({ where: { name: from }, data: { name: to } })));
  console.log(`${done.reduce((s, r) => s + r.count, 0)} ligne(s) mise(s) à jour.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
