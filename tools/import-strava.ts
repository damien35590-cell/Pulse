/**
 * Import ponctuel de l'historique Strava depuis l'archive officielle exportée (dossier dézippé contenant activities.csv et activities/).
 *
 *   npx tsx tools/import-strava.ts "C:\strava-export"            → simulation : rapport, rien n'est écrit (défaut)
 *   npx tsx tools/import-strava.ts "C:\strava-export" --dry-run  → idem
 *   npx tsx tools/import-strava.ts "C:\strava-export" --apply    → écrit en base, par lots
 *
 * Options : --user <email> (défaut : ALLOWED_EMAIL du .env, sinon l'unique utilisateur) · --batch <n> (lot de 25) · --limit <n> (les n plus récentes, pour essayer).
 *
 * Reprenable : chaque activité porte dedupeKey « strava-<id> » (source « strava ») ; relancer ignore ce qui est déjà en base.
 * Une activité qui ressemble à une activité déjà en base (Intervals.icu, Google Fit, MyWhoosh… : même sport, début à ±5 min, durée proche)
 * n'est jamais importée ni écrasée : elle figure dans le rapport avec sa correspondance.
 * Le matériel (chaussures, vélos) n'est pas rattaché : le matériel par défaut d'aujourd'hui fausserait l'usure.
 * Après chaque création, le pipeline habituel s'exécute (charge, records, badges, anecdote : lib/pipeline/post-import.ts), du plus ancien au plus récent.
 */
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gunzipSync } from "fflate";

// Les variables doivent être lues avant de charger Prisma (lib/prisma crée le client à l'import). .env.local prime sur .env, comme dans Next.
for (const f of [".env.local", ".env"]) { try { process.loadEnvFile(f); } catch { /* absent : variables déjà définies dans l'environnement */ } }
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) process.env.DIRECT_URL = process.env.DATABASE_URL;

type Parsed = import("../lib/import/types").ParsedActivity;
type Row = import("../lib/import/strava").StravaRow;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const opt = (n: string) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const optNum = (n: string, d: number) => { const v = Number(opt(n)); return Number.isFinite(v) && v > 0 ? Math.floor(v) : d; };
const folder = args.find((a, i) => !a.startsWith("--") && !["--user", "--batch", "--limit"].includes(args[i - 1] ?? ""));

const fmtDate = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ");
const fmtDur = (s: number) => `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
const pad = (s: string | number, n: number) => String(s).padEnd(n);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main() {
  if (!folder) { console.error('Usage : npx tsx tools/import-strava.ts "<dossier de l\'export>" [--dry-run | --apply] [--user <email>] [--batch <n>] [--limit <n>]'); process.exitCode = 1; return; }
  if (flag("apply") && flag("dry-run")) { console.error("--apply et --dry-run s'excluent."); process.exitCode = 1; return; }
  const apply = flag("apply");
  const root = resolve(folder), csvPath = join(root, "activities.csv");
  if (!existsSync(csvPath)) { console.error(`activities.csv introuvable dans ${root}`); process.exitCode = 1; return; }

  const { prisma } = await import("../lib/prisma");
  const { parseFit } = await import("../lib/import/fit");
  const { parseXmlTrack } = await import("../lib/import/xml-track");
  const { activityCreateData, gpsOf } = await import("../lib/import/build");
  const { processActivity } = await import("../lib/pipeline/post-import");
  const { isSoft } = await import("../lib/sports");
  const S = await import("../lib/import/strava");
  const { Prisma } = await import("@prisma/client");

  /** Lit un fichier de l'archive (.fit, .gpx, .tcx, avec ou sans .gz, décompressé en mémoire). */
  async function readTrack(rel: string): Promise<Parsed> {
    const path = join(root, rel);
    if (!existsSync(path)) throw new Error("fichier introuvable dans l'archive");
    let bytes = new Uint8Array(await readFile(path)), name = rel.toLowerCase();
    if (name.endsWith(".gz")) { bytes = gunzipSync(bytes); name = name.slice(0, -3); }
    if (name.endsWith(".fit")) return parseFit(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, rel);
    if (name.endsWith(".gpx")) return parseXmlTrack(new TextDecoder().decode(bytes), rel, "gpx");
    if (name.endsWith(".tcx")) return parseXmlTrack(new TextDecoder().decode(bytes), rel, "tcx");
    throw new Error("format non pris en charge");
  }
  const build = async (row: Row) => S.toParsed(row, row.file ? await readTrack(row.file) : null);

  // ───────── Utilisateur ─────────
  const email = (opt("user") ?? process.env.ALLOWED_EMAIL ?? "").trim().toLowerCase();
  const users = await prisma.user.findMany({ where: email ? { email } : undefined, select: { id: true, email: true } });
  if (users.length !== 1) { console.error(email ? `Aucun utilisateur ${email}.` : `${users.length} utilisateurs en base : précisez --user <email>.`); process.exitCode = 1; return; }
  const uid = users[0].id;

  // ───────── CSV ─────────
  const { rows: all, missing } = S.readStravaCsv(readFileSync(csvPath, "utf8"));
  if (missing.length) { console.error(`Colonnes introuvables dans activities.csv : ${missing.join(", ")}`); process.exitCode = 1; return; }
  const unique = new Map(all.map((r) => [r.id, r]));
  const csvDupes = all.length - unique.size;
  const rows = [...unique.values()]
    .sort((a, b) => +(b.startedAt ?? 0) - +(a.startedAt ?? 0)).slice(0, optNum("limit", Infinity));

  // ───────── Contexte en base ─────────
  const times = rows.flatMap((r) => (r.startedAt ? [+r.startedAt] : []));
  const [known, stravaKeys] = await Promise.all([
    times.length ? prisma.activity.findMany({
      where: { userId: uid, startedAt: { gte: new Date(Math.min(...times) - 864e5), lte: new Date(Math.max(...times) + 864e5) } },
      select: { id: true, type: true, title: true, startedAt: true, movingTimeS: true, elapsedTimeS: true, source: true, dedupeKey: true },
    }) : [],
    prisma.activity.findMany({ where: { userId: uid, dedupeKey: { startsWith: "strava-" } }, select: { dedupeKey: true } }),
  ]);
  const imported = new Set(stravaKeys.map((k) => k.dedupeKey));

  // ───────── Classement ─────────
  type Item = { row: Row; a: Parsed };
  const fresh: Item[] = [];
  const already: Row[] = [], noFile: Row[] = [];
  const duplicates: { row: Row; a: Parsed; m: NonNullable<ReturnType<typeof S.findDuplicate>> }[] = [];
  const errors: { row: Row; why: string }[] = [];
  const excluded: Row[] = [];
  const unknown = new Map<string, number>(), dateGaps: string[] = [];

  let n = 0;
  for (const row of rows) {
    if (++n % 50 === 0) process.stderr.write(`\r  lecture ${n}/${rows.length}…`);
    if (S.isExcludedType(row.type)) { excluded.push(row); continue; }
    const mapped = S.mapStravaType(row.type, row.commute);
    if (!mapped.known) unknown.set(row.type || "(vide)", (unknown.get(row.type || "(vide)") ?? 0) + 1);
    if (imported.has(S.stravaKey(row.id))) { already.push(row); continue; }
    if (!row.file) noFile.push(row);
    let a: Parsed;
    try { a = await build(row); } catch (e) { errors.push({ row, why: errMsg(e) }); continue; }
    if (row.startedAt && Math.abs(+row.startedAt - Date.parse(a.startedAt)) > 10 * 60e3) dateGaps.push(`${row.id} : CSV ${row.rawDate}, fichier ${a.startedAt}`);
    const m = S.findDuplicate({ type: a.type, startedAt: new Date(a.startedAt), movingTimeS: a.movingTimeS, elapsedTimeS: a.elapsedTimeS }, known);
    if (m) duplicates.push({ row, a: { ...a, points: [] }, m });
    else fresh.push({ row, a: { ...a, points: [] } }); // les points sont relus au moment d'écrire : 370 traces ne tiennent pas toutes en mémoire
  }
  process.stderr.write("\r".padEnd(40) + "\r");

  // ───────── Rapport ─────────
  const line = (s = "") => console.log(s);
  line(`\nImport Strava — ${apply ? "ÉCRITURE" : "SIMULATION (rien n'est écrit)"} — ${users[0].email ?? uid}`);
  line(`${rows.length} activité(s) dans activities.csv${csvDupes ? ` (+ ${csvDupes} ligne(s) en double ignorée(s))` : ""}\n`);
  line(`  à importer            ${String(fresh.length).padStart(5)}`);
  line(`  doublons (gardées)    ${String(duplicates.length).padStart(5)}   déjà en base via une autre source, non importées`);
  line(`  déjà importées        ${String(already.length).padStart(5)}   source « strava », relance`);
  line(`  sans fichier          ${String(noFile.length).padStart(5)}   activités manuelles, données du CSV seules`);
  line(`  erreurs               ${String(errors.length).padStart(5)}   non importées`);
  line(`  types exclus          ${String(excluded.length).padStart(5)}   ${[...new Set(excluded.map((r) => r.type))].join(", ") || "-"}, non importés`);
  line(`  types inconnus        ${String([...unknown.values()].reduce((s, v) => s + v, 0)).padStart(5)}   importés en « autre »`);

  const byType = new Map<string, { n: number; km: number }>();
  for (const { a } of fresh) { const t = byType.get(a.type) ?? { n: 0, km: 0 }; t.n++; t.km += a.distanceM / 1000; byType.set(a.type, t); }
  if (byType.size) {
    line("\nÀ importer, par sport :");
    for (const [t, v] of [...byType].sort((x, y) => y[1].n - x[1].n)) line(`  ${pad(t, 8)} ${String(v.n).padStart(4)}   ${v.km.toFixed(0).padStart(6)} km${isSoft(t) ? "   (activité douce : hors séances d'entraînement)" : ""}`);
    const commutes = fresh.filter((f) => S.mapStravaType(f.row.type, f.row.commute).commute).length;
    if (commutes) line(`  dont ${commutes} déplacement(s)/vélotaf(s) marqué(s) « transport » dans Strava`);
    const years = new Map<string, number>();
    for (const { a } of fresh) years.set(a.startedAt.slice(0, 4), (years.get(a.startedAt.slice(0, 4)) ?? 0) + 1);
    line(`  par année : ${[...years].sort().map(([y, c]) => `${y} ${c}`).join(" · ")}`);
    const noGps = fresh.filter((f) => !f.row.file).length;
    if (noGps) line(`  ${noGps} sans trace GPS ni capteurs (saisie manuelle)`);
  }

  if (unknown.size) {
    line("\nTypes Strava inconnus (importés en « autre », à reclasser si besoin) :");
    for (const [t, c] of unknown) line(`  ${t} : ${c}`);
  }
  if (duplicates.length) {
    line("\nDoublons — l'activité existante est conservée :");
    for (const { row, a, m } of duplicates)
      line(`  ${fmtDate(new Date(a.startedAt))} ${pad(a.type, 7)} ${fmtDur(a.movingTimeS)}  « ${row.name} » (${row.id})  ↔  ${m.existing.source} « ${m.existing.title} » ${fmtDate(m.existing.startedAt)} ${fmtDur(m.existing.movingTimeS)}  [${m.reason}, Δ ${Math.round(m.startDiffS)} s]`);
  }
  if (noFile.length) {
    line("\nSans fichier (importées avec les données du CSV) :");
    for (const r of noFile) line(`  ${r.rawDate}  ${r.type}  « ${r.name} » (${r.id})`);
  }
  if (errors.length) {
    line("\nErreurs (non importées) :");
    for (const { row, why } of errors) line(`  ${row.id} « ${row.name} » ${row.file ?? ""} : ${why}`);
  }
  if (dateGaps.length) {
    line("\nÉcart de plus de 10 min entre le CSV et le fichier (le fichier fait foi) :");
    for (const g of dateGaps) line(`  ${g}`);
  }

  if (!apply) { line("\nSimulation terminée : rien n'a été modifié. Relancer avec --apply pour écrire."); return; }

  // ───────── Écriture, par lots, du plus ancien au plus récent ─────────
  const order = [...fresh].reverse(), size = optNum("batch", 25);
  let created = 0, raced = 0, failed = 0, postErrors = 0;
  line(`\nÉcriture de ${order.length} activité(s) par lots de ${size}…`);
  for (let i = 0; i < order.length; i += size) {
    for (const { row } of order.slice(i, i + size)) {
      try {
        const a = await build(row);
        const { id } = await prisma.activity.create({ data: activityCreateData(uid, a), select: { id: true } });
        created++;
        const res = await processActivity(id, { points: gpsOf(a) });
        postErrors += res.errors.length;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { raced++; continue; } // créée entre-temps : relance
        failed++; console.error(`  ✗ ${row.id} « ${row.name} » : ${errMsg(e)}`);
      }
    }
    line(`  ${Math.min(i + size, order.length)}/${order.length}`);
  }
  line(`\nTerminé : ${created} créée(s), ${raced} déjà présente(s), ${failed} en échec${postErrors ? `, ${postErrors} erreur(s) du pipeline post-import (voir plus haut)` : ""}.`);
  if (failed) { line("Relancer la même commande reprend les échecs sans créer de doublon."); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { const { prisma } = await import("../lib/prisma"); await prisma.$disconnect(); });
