// Diagnostic lecture seule : activités Google Fit d'un même type séparées de moins de 10 min (une sortie découpée).
// Lancer avec : npx tsx tools/diag-gfit-split.ts [--days=60]
// Données brutes d'une fenêtre : --raw --from=2026-10-27T12:30:00+01:00 --to=2026-10-27T13:30:00+01:00
//   sessions et segments Google Fit (type, début, fin, distance) + activités Pulse de la fenêtre. Il faut un jeton Google valide en base.
import { prisma } from "../lib/prisma";
import { fetchSessionDistanceM, getValidAccessToken } from "../lib/sync/google-fit";
import { groupFragments, MERGE_GAP_MS } from "../lib/sync/google-fit-merge";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const fmt = (d: Date | number) => new Date(d).toLocaleString("fr-FR", { timeZone: "Europe/Paris" });
const km = (m: number | null) => (m == null ? "?" : `${(m / 1000).toFixed(2)} km`);

async function raw(from: number, to: number) {
  const account = await prisma.account.findFirst({ where: { provider: "google" } });
  if (!account?.access_token) return console.log("Pas de compte Google lié.");
  const token = await getValidAccessToken(account);
  // Une journée autour de la fenêtre : une session qui commence avant 12:30 doit apparaître.
  const s = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${new Date(from - 3 * 3600e3).toISOString()}&endTime=${new Date(to + 3 * 3600e3).toISOString()}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await s.json();
  if (!s.ok) return console.log(`Sessions : HTTP ${s.status}`, JSON.stringify(j).slice(0, 200));
  console.log(`\nSessions Google Fit (/v1/users/me/sessions) :`);
  for (const x of j.session ?? []) {
    if (+x.endTimeMillis < from || +x.startTimeMillis > to) continue;
    console.log(`  ${fmt(+x.startTimeMillis)} → ${fmt(+x.endTimeMillis)}  type ${x.activityType}  « ${x.name ?? ""} »  actif ${x.activeTimeMillis ? Math.round(x.activeTimeMillis / 1000) + " s" : "?"}  ${km(await fetchSessionDistanceM(token, +x.startTimeMillis, +x.endTimeMillis))}  id ${x.id}  app ${x.application?.packageName ?? ""}`);
  }
  const g = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ aggregateBy: [{ dataTypeName: "com.google.activity.segment" }], bucketByActivitySegment: { minDurationMillis: 1 }, startTimeMillis: from, endTimeMillis: to }),
  });
  const k = await g.json();
  console.log(`\nSegments d'activité bruts (tous types, toutes durées ; 7 = marche, 8 = course, 3 = immobile, 4 = inconnu) :`);
  for (const b of k.bucket ?? []) console.log(`  ${fmt(+b.startTimeMillis)} → ${fmt(+b.endTimeMillis)}  type ${b.activity}  ${Math.round((+b.endTimeMillis - +b.startTimeMillis) / 1000)} s  ${km(await fetchSessionDistanceM(token, +b.startTimeMillis, +b.endTimeMillis))}`);
  console.log(`\nDistance totale de la fenêtre : ${km(await fetchSessionDistanceM(token, from, to))}`);
}

async function main() {
  if (process.argv.includes("--raw")) {
    const from = Date.parse(arg("from")!), to = Date.parse(arg("to")!);
    const acts = await prisma.activity.findMany({ where: { startedAt: { gte: new Date(from - 3 * 3600e3), lte: new Date(to) } }, orderBy: { startedAt: "asc" }, select: { type: true, title: true, source: true, dedupeKey: true, startedAt: true, movingTimeS: true, elapsedTimeS: true, distanceM: true } });
    console.log("Activités Pulse :");
    for (const a of acts) if (+a.startedAt + 1000 * Math.max(a.movingTimeS, a.elapsedTimeS ?? 0) >= from) console.log(`  ${fmt(a.startedAt)}  ${a.type}  ${a.source}  ${a.dedupeKey}  ${Math.round(a.movingTimeS / 60)} min  ${km(a.distanceM)}  « ${a.title} »`);
    await raw(from, to);
    return;
  }
  const days = Number(arg("days") ?? 60);
  const acts = await prisma.activity.findMany({
    where: { OR: [{ source: "google-fit" }, { dedupeKey: { startsWith: "gfit-" } }], startedAt: { gte: new Date(Date.now() - days * 864e5) } },
    orderBy: { startedAt: "asc" },
    select: { id: true, userId: true, type: true, title: true, dedupeKey: true, startedAt: true, movingTimeS: true, elapsedTimeS: true, distanceM: true },
  });
  const groups = groupFragments(acts);
  console.log(`${acts.length} activités Google Fit sur ${days} jours ; ${groups.length} sortie(s) découpée(s) (écart < ${MERGE_GAP_MS / 60000} min) :`);
  for (const g of groups) {
    console.log(`\n${g[0].type} · ${fmt(g[0].startedAt)}`);
    for (const a of g) console.log(`  ${a.dedupeKey}  ${fmt(a.startedAt)}  ${Math.round(a.movingTimeS / 60)} min  ${km(a.distanceM)}`);
  }
}
main().finally(() => prisma.$disconnect());
