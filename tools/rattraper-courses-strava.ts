/**
 * Rattrape Activity.isRace pour les activités Strava déjà en base, depuis l'activities.csv de l'archive officielle
 * (colonne « Compétition », ou type d'entraînement « Course » : workout_type 1).
 *
 *   npx tsx tools/rattraper-courses-strava.ts "C:\strava-export"            → simulation (défaut)
 *   npx tsx tools/rattraper-courses-strava.ts "C:\strava-export" --apply    → écrit
 *
 * Options : --user <email> (défaut : ALLOWED_EMAIL du .env, sinon l'unique utilisateur).
 * Correspondance : d'abord l'identifiant Strava (externalId), sinon départ à ±5 min et distance à ±3 % (activité venue d'une autre source).
 * Ne fait que passer isRace à true : un choix manuel (case décochée) n'est jamais écrasé dans l'autre sens.
 * Base : dev par défaut ; pour la prod, voir CLAUDE.md (vercel env pull + --env-file, avec --dry-run d'abord).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

for (const f of [".env.local", ".env"]) { try { process.loadEnvFile(f); } catch { /* absent */ } }
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) process.env.DIRECT_URL = process.env.DATABASE_URL;

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const ui = args.indexOf("--user");
const folder = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--user");

async function main() {
  if (!folder) { console.error('Usage : npx tsx tools/rattraper-courses-strava.ts "<dossier de l\'export>" [--apply] [--user <email>]'); process.exitCode = 1; return; }
  const csvPath = join(resolve(folder), "activities.csv");
  if (!existsSync(csvPath)) { console.error(`activities.csv introuvable dans ${resolve(folder)}`); process.exitCode = 1; return; }
  const { prisma } = await import("../lib/prisma");
  const { readStravaCsv } = await import("../lib/import/strava");

  const email = ((ui >= 0 ? args[ui + 1] : undefined) ?? process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
  const users = await prisma.user.findMany({ where: email ? { email } : undefined, select: { id: true, email: true } });
  if (users.length !== 1) { console.error(email ? `Aucun utilisateur ${email}.` : `${users.length} utilisateurs en base : précisez --user <email>.`); process.exitCode = 1; return; }
  const uid = users[0].id;

  const { rows, missing } = readStravaCsv(readFileSync(csvPath, "utf8"));
  if (missing.length) { console.error(`Colonnes introuvables : ${missing.join(", ")}`); process.exitCode = 1; return; }
  const races = rows.filter((r) => r.isRace);
  console.log(`\nRattrapage des compétitions Strava — ${apply ? "ÉCRITURE" : "SIMULATION"} — ${users[0].email ?? uid}`);
  console.log(`${rows.length} ligne(s) dans activities.csv, dont ${races.length} marquée(s) compétition.`);
  if (!races.length) { console.log("Rien à faire (colonne « Compétition » absente ou jamais cochée)."); await prisma.$disconnect(); return; }

  const byExternal = new Map((await prisma.activity.findMany({ where: { userId: uid, source: "strava", externalId: { in: races.map((r) => r.id) } }, select: { id: true, isRace: true, externalId: true, title: true, startedAt: true } })).map((a) => [a.externalId!, a]));
  const ids: string[] = [];
  let already = 0, unmatched = 0;
  for (const r of races) {
    let a = byExternal.get(r.id);
    if (!a && r.startedAt) {
      const near = await prisma.activity.findMany({ where: { userId: uid, type: "RUN", startedAt: { gte: new Date(+r.startedAt - 5 * 60e3), lte: new Date(+r.startedAt + 5 * 60e3) } }, select: { id: true, isRace: true, externalId: true, title: true, startedAt: true, distanceM: true } });
      const d = r.distanceM ?? 0;
      a = near.filter((x) => d > 0 && Math.abs(x.distanceM - d) / d <= 0.03).sort((x, y) => Math.abs(+x.startedAt - +r.startedAt!) - Math.abs(+y.startedAt - +r.startedAt!))[0];
    }
    if (!a) { unmatched++; console.log(`  ? introuvable en base : ${r.rawDate} « ${r.name} » (${r.id})`); continue; }
    if (a.isRace) { already++; continue; }
    ids.push(a.id);
    console.log(`  ✓ ${a.startedAt.toISOString().slice(0, 16).replace("T", " ")} « ${a.title} »`);
  }
  console.log(`\n${ids.length} à marquer, ${already} déjà marquée(s), ${unmatched} sans correspondance.`);
  if (apply && ids.length) { const r = await prisma.activity.updateMany({ where: { userId: uid, id: { in: ids } }, data: { isRace: true } }); console.log(`${r.count} activité(s) mise(s) à jour.`); }
  else if (!apply) console.log("Simulation : rien n'a été modifié. Relancer avec --apply pour écrire.");
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
