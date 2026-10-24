/**
 * Régénère Activity.story avec le générateur unique de lib/coach/story.ts (record > série > écart à la moyenne 30 jours > null ;
 * jamais pour E-bike ni marche). S'applique à TOUTES les activités qui ont déjà une anecdote. Idempotent : le résultat ne dépend que de l'état de la base.
 *
 *   node --env-file=.env --import tsx tools/regenerer-stories.ts --dry-run   (récapitulatif par sport + 15 exemples, n'écrit rien)
 *   node --env-file=.env --import tsx tools/regenerer-stories.ts             (sauvegarde id + ancienne phrase dans tools/backups/, puis écrit)
 *
 * Base du .env = dev. Pour la prod : procédure `vercel env pull` de CLAUDE.md (--env-file=.env.production.local).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";
import { storyForActivity } from "../lib/coach/story";

const DRY = process.argv.includes("--dry-run");
const ORDER = ["RUN", "RIDE", "HIKE", "WORKOUT", "WALK", "EBIKE"];

type Row = { id: string; type: string; before: string; after: string | null };

async function main() {
  const acts = await prisma.activity.findMany({ where: { story: { not: null } }, select: { id: true, type: true, story: true }, orderBy: { startedAt: "desc" } });
  const rows: Row[] = [];
  for (const a of acts) rows.push({ id: a.id, type: a.type, before: a.story!, after: (await storyForActivity(a.id))?.text ?? null });

  const stat = new Map<string, { rewritten: number; nulled: number; unchanged: number }>();
  for (const r of rows) {
    const s = stat.get(r.type) ?? { rewritten: 0, nulled: 0, unchanged: 0 };
    if (r.after === r.before) s.unchanged++; else if (r.after === null) s.nulled++; else s.rewritten++;
    stat.set(r.type, s);
  }
  console.log(`${DRY ? "DRY-RUN — " : ""}${rows.length} anecdotes lues`);
  console.log("sport     réécrites  supprimées  inchangées");
  for (const [t, s] of [...stat].sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0])))
    console.log(`${t.padEnd(9)} ${String(s.rewritten).padStart(9)}  ${String(s.nulled).padStart(10)}  ${String(s.unchanged).padStart(10)}`);
  const total = [...stat.values()].reduce((t, s) => ({ rewritten: t.rewritten + s.rewritten, nulled: t.nulled + s.nulled, unchanged: t.unchanged + s.unchanged }), { rewritten: 0, nulled: 0, unchanged: 0 });
  console.log(`TOTAL     ${String(total.rewritten).padStart(9)}  ${String(total.nulled).padStart(10)}  ${String(total.unchanged).padStart(10)}`);

  // 15 exemples répartis par sport (ordre RUN, RIDE, HIKE, WORKOUT, WALK, EBIKE), en privilégiant les nouvelles phrases distinctes.
  const changed = rows.filter((r) => r.after !== r.before);
  const byType = ORDER.map((t) => {
    const seen = new Set<string>();
    return changed.filter((r) => r.type === t).sort((a, b) => Number(!!b.after) - Number(!!a.after)).filter((r) => { const k = (r.after ?? "∅").replace(/\d+/g, "N"); if (seen.has(k)) return false; seen.add(k); return true; });
  });
  const examples: Row[] = [];
  for (let i = 0; examples.length < 15 && byType.some((l) => i < l.length); i++) for (const l of byType) if (l[i] && examples.length < 15) examples.push(l[i]);
  console.log("\nExemples :");
  for (const r of examples) console.log(`${r.type.padEnd(8)} ${r.id.slice(0, 8)}\n  avant : ${r.before}\n  après : ${r.after ?? "(aucune anecdote)"}`);

  if (!DRY && changed.length) {
    mkdirSync("tools/backups", { recursive: true });
    const host = (process.env.DATABASE_URL ?? "").match(/@([^/:?]+)/)?.[1]?.split(".")[0] ?? "db";
    const file = `tools/backups/stories-${host}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    writeFileSync(file, JSON.stringify(changed.map((r) => ({ id: r.id, story: r.before })), null, 1));
    console.log(`\nSauvegarde : ${file} (${changed.length} lignes)`);
    for (const r of changed) await prisma.activity.update({ where: { id: r.id }, data: { story: r.after } });
    console.log(`${changed.length} anecdotes mises à jour.`);
  }
  await prisma.$disconnect();
}
main();
