/**
 * Rattrapage : recolle les sorties Google Fit importées en plusieurs morceaux (une activité par pause) avant la fusion à la synchro.
 *
 *   npx tsx tools/fusionner-gfit.ts                  → affiche seulement ce qui serait recollé (par défaut)
 *   npx tsx tools/fusionner-gfit.ts --apply          → recolle
 *   options : --type=RUN (un seul type), --days=365 (période, tout l'historique par défaut)
 *
 * Même règle que la synchro (lib/sync/google-fit-merge.ts) : activités Google Fit d'un même type, moins de 10 min entre la fin de l'une
 * et le début de la suivante. Le premier morceau est gardé (ressenti, matériel, séance du programme, records des autres le rejoignent),
 * les totaux sont refaits sur toute la sortie, les ids des morceaux vont dans mergedSourceIds (la synchro ne les réimporte plus),
 * puis le traitement d'import est rejoué (charge, records, programme, anecdote).
 *
 * À lancer APRÈS tools/reconstruire-gfit.ts : les sorties couvertes par une session Google Fit doivent d'abord être reconstruites depuis elle.
 *
 * Base : DIRECT_URL du .env, donc la branche Neon de dev. Pour la prod (voir CLAUDE.md), sans garder son adresse sur le disque :
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx tools/fusionner-gfit.ts
 *   node --env-file=.env.production.local --import tsx tools/fusionner-gfit.ts --apply
 *   rm .env.production.local
 */
import type { ActivityType } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { groupFragments, MERGE_GAP_MS, MIN_WALK_M } from "../lib/sync/google-fit-merge";
import { mergeSplitActivity, processActivity } from "../lib/pipeline/post-import";

const apply = process.argv.includes("--apply");
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
const srcIds = (a: { dedupeKey: string | null; mergedSourceIds: string[] }) => (a.mergedSourceIds.length ? a.mergedSourceIds : a.dedupeKey ? [a.dedupeKey.replace(/^gfit-/, "")] : []);

async function main() {
  const type = arg("type") as ActivityType | undefined, days = arg("days") ? Number(arg("days")) : null;
  const acts = await prisma.activity.findMany({
    where: {
      OR: [{ source: "google-fit" }, { dedupeKey: { startsWith: "gfit-" } }],
      ...(type ? { type } : {}),
      ...(days ? { startedAt: { gte: new Date(Date.now() - days * 864e5) } } : {}),
    },
    orderBy: { startedAt: "asc" },
    select: { id: true, userId: true, type: true, title: true, dedupeKey: true, mergedSourceIds: true, startedAt: true, movingTimeS: true, elapsedTimeS: true, distanceM: true },
  });
  // Même règle que la synchro : pas d'« autre », et une marche ne compte qu'à partir de 300 m une fois recollée (sinon, c'est du bruit : tools/supprimer-marches-gfit.ts).
  const groups = groupFragments(acts).filter((g) => g[0].type !== "OTHER" && (g[0].type !== "WALK" || g.reduce((s, a) => s + a.distanceM, 0) >= MIN_WALK_M));
  console.log(`${apply ? "Recollage" : "Simulation (rien n'est écrit ; --apply pour recoller)"} : ${groups.length} sortie(s) en plusieurs morceaux (écart < ${MERGE_GAP_MS / 60000} min) sur ${acts.length} activités Google Fit.`);

  let done = 0;
  for (const g of groups) {
    const km = g.reduce((s, a) => s + a.distanceM, 0) / 1000, min = g.reduce((s, a) => s + a.movingTimeS, 0) / 60;
    console.log(`\n${g[0].type} · ${fmt(g[0].startedAt)} · ${g.length} morceaux → ${km.toFixed(2)} km, ${Math.round(min)} min en mouvement`);
    for (const a of g) console.log(`  ${a.id}  ${fmt(a.startedAt)}  ${Math.round(a.movingTimeS / 60)} min  ${(a.distanceM / 1000).toFixed(2)} km  « ${a.title} »`);
    if (!apply) continue;
    const kept = await mergeSplitActivity(g.map((a) => a.id), [...new Set(g.flatMap(srcIds))]);
    if (!kept) { console.log("  ✗ introuvable, ignorée"); continue; }
    const r = await processActivity(kept);
    console.log(`  ✓ gardée : ${kept}${r.errors.length ? ` (avertissements : ${r.errors.join(" ; ")})` : ""}`);
    done++;
  }
  if (apply) console.log(`\n${done} sortie(s) recollée(s).`);
}
main().finally(() => prisma.$disconnect());
