/**
 * Script ponctuel : calcule le ruban de zones (Activity.zoneRibbon, lib/art/zone-ribbon.ts) des activités déjà en base, avec sa source
 * (FC, puissance ou allure) et le seuil utilisé. Rafraîchit d'abord la FC max estimée (sauf FC max saisie).
 *
 *   npx tsx tools/calculer-rubans.ts --dry-run   → compte seulement ce qui serait écrit
 *   npx tsx tools/calculer-rubans.ts             → applique ce qui est en attente (même sélection que la tâche de nuit, sans la limite de 50)
 *   npx tsx tools/calculer-rubans.ts --all       → recalcule toutes les activités, même celles dont le ruban est à jour
 *
 * La tâche de nuit (/api/cron/sync-intervals) et les changements de seuil dans l'app recalculent déjà seuls ce qui devient périmé :
 * ce script sert au premier rattrapage et à repartir de zéro (--all).
 * Les seuils utilisés sont ceux d'aujourd'hui (FC max saisie sinon estimée, FTP, VMA enregistrée), appliqués à toutes les dates.
 * Base : DIRECT_URL du .env, donc la branche Neon de dev. Pour la prod (voir CLAUDE.md), sans garder son adresse sur le disque :
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local --import tsx tools/calculer-rubans.ts --dry-run
 *   rm .env.production.local
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getZones } from "../lib/data/zones";
import { computeZoneRibbon, getRibbonZones, pendingRibbonIds, writeRibbon } from "../lib/data/zone-ribbon";
import { estimateHrMax, refreshEstimatedHrMax } from "../lib/physio/hr-max";
import { cardArt } from "../lib/art/card";
import { hasIntervalStructure, hasPaceIntervalStructure } from "../lib/art/effort";

const dryRun = process.argv.includes("--dry-run"), all = process.argv.includes("--all");
const fmt = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "aucun";
const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const total = { seen: 0, ribbon: 0, none: 0, interval: 0, effort: 0, keyLinked: 0 };
  const bySource = new Map<string, number>(), byType = new Map<string, number>(), intervalBySource = new Map<string, number>();

  for (const u of users) {
    const who = u.email ?? u.id;
    const z = await getZones(u.id);
    // FC max estimée : recalculée d'abord, les rubans en dépendent (une FC max saisie n'est jamais touchée).
    let hrNote = z.hrManual ? `${z.hrMax} bpm (saisie)` : "";
    let estimated: number | null = null;
    if (!z.hrManual) {
      const est = await estimateHrMax(u.id);
      estimated = est.value;
      hrNote = est.value
        ? `${est.value} bpm (estimée, ${est.source === "observed" ? "valeur observée sur 5 s" : "formule de Tanaka"}${est.observed != null && est.source === "formula" ? `, observée ${est.observed}` : ""})`
        : "— (estimation impossible : aucune FC exploitable sur 12 mois, pas de date de naissance)";
      if (!dryRun) await refreshEstimatedHrMax(u.id);
    }
    const zones = await getRibbonZones(u.id);
    if (dryRun && !z.hrManual) zones.hrMax = estimated; // simulation : les rubans se calculeraient avec l'estimation fraîche
    console.log(`\n${who} : FC max ${hrNote} · FTP ${zones.ftp ?? "inconnue"} W · VMA ${zones.vma ?? "inconnue"} km/h`);

    // Une activité à la fois : les séries et traces sont volumineuses.
    const seen = new Set<string>(), queue: string[] = [];
    if (all) queue.push(...(await prisma.activity.findMany({ where: { userId: u.id }, select: { id: true }, orderBy: { startedAt: "asc" } })).map((a) => a.id));
    for (let i = 0; ; i++) {
      if (!all && i % 200 === 0) { // même sélection que la tâche de nuit, par paquets de 200
        const next = await pendingRibbonIds(u.id, zones, 200, [...seen]);
        if (!next.length) break;
        queue.push(...next);
      }
      const id = queue[i];
      if (!id) break;
      seen.add(id);
      total.seen++;
      const r = await computeZoneRibbon(id, zones);
      if (!dryRun) await writeRibbon(id, r); // sans ruban : tout est remis à null, un ruban périmé (seuils retirés) ne survit pas
      if (!r) { total.none++; continue; }
      const a = await prisma.activity.findUnique({ where: { id }, select: { type: true, plannedSession: { select: { kind: true, title: true } } } });
      total.ribbon++;
      bump(bySource, r.source);
      bump(byType, a?.type ?? "?");
      const interval = r.interval ? r.interval.is : (r.source === "pace" ? hasPaceIntervalStructure : hasIntervalStructure)(r.segments);
      if (interval) { total.interval++; bump(intervalBySource, r.source); }
      const art = a && cardArt({ type: a.type, hasRoute: true, zoneRibbon: r.segments, zoneRibbonSource: r.source, isInterval: r.interval?.is ?? null, plannedSession: a.plannedSession });
      if (art?.effort) { total.effort++; if (a?.plannedSession) total.keyLinked++; }
    }

    const stored = await prisma.activity.groupBy({ by: ["zoneRibbonSource"], where: { userId: u.id, zoneRibbon: { not: Prisma.DbNull } }, _count: true });
    console.log(`Rubans en base (${dryRun ? "avant simulation" : "après"}) : ${stored.map((s) => `${s.zoneRibbonSource ?? "source inconnue (d'avant le suivi)"} ${s._count}`).join(", ") || "aucun"}`);
  }

  console.log(`\n${total.seen} activité(s) examinée(s) : ${total.ribbon} ${dryRun ? "recevraient" : "ont reçu"} un ruban, ${total.none} sans FC, puissance ni allure exploitable (restent à null).`);
  console.log(`Par source : ${fmt(bySource)}`);
  console.log(`Par type   : ${fmt(byType)}`);
  console.log(`Séances d'intervalles détectées (≥ 4 blocs Z4+, 10–70 % du temps) : ${total.interval} (${fmt(intervalBySource)})`);
  console.log(`Cartes en EffortStrip : ${total.effort} dont ${total.keyLinked} liées à une séance clé du programme`);
  if (dryRun) console.log("\nSimulation : rien n'a été modifié.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
