// Diagnostic lecture seule : activités Google Fit d'un même type séparées de moins de 10 min (une sortie découpée par ses pauses).
// Lancer avec : npx tsx tools/diag-gfit-split.ts [--days=60]
// Avec --raw --day=AAAA-MM-JJ : sessions et segments bruts de Google Fit ce jour-là (le jeton peut être rafraîchi en base).
import { prisma } from "../lib/prisma";
import { getValidAccessToken } from "../lib/sync/google-fit";
import { groupFragments, MERGE_GAP_MS } from "../lib/sync/google-fit-merge";

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const fmt = (d: Date) => d.toLocaleString("fr-FR", { timeZone: "Europe/Paris" });

async function raw(day: string) {
  const account = await prisma.account.findFirst({ where: { provider: "google" } });
  if (!account?.access_token) return console.log("Pas de compte Google lié.");
  const token = await getValidAccessToken(account);
  const start = new Date(`${day}T00:00:00+02:00`), end = new Date(+start + 864e5);
  const s = await fetch(`https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${start.toISOString()}&endTime=${end.toISOString()}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await s.json();
  console.log(`Sessions (${s.status}) :`);
  for (const x of j.session ?? []) console.log(" ", x.id, "type", x.activityType, fmt(new Date(+x.startTimeMillis)), "→", fmt(new Date(+x.endTimeMillis)), x.name ?? "", x.application?.packageName ?? "");
  const g = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ aggregateBy: [{ dataTypeName: "com.google.activity.segment" }], bucketByActivitySegment: { minDurationMillis: 60 * 1000 }, startTimeMillis: +start, endTimeMillis: +end }),
  });
  const k = await g.json();
  console.log(`Segments ≥ 1 min (${g.status}) :`);
  for (const b of k.bucket ?? []) console.log(" ", "type", b.activity, fmt(new Date(+b.startTimeMillis)), "→", fmt(new Date(+b.endTimeMillis)));
}

async function main() {
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
    for (const a of g) console.log(`  ${a.dedupeKey}  ${fmt(a.startedAt)}  ${Math.round(a.movingTimeS / 60)} min  ${(a.distanceM / 1000).toFixed(2)} km`);
  }
  const day = arg("day");
  if (process.argv.includes("--raw") && day) await raw(day);
}
main().finally(() => prisma.$disconnect());
