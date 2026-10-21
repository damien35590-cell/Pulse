import { prisma } from "@/lib/prisma";
import { parseOne } from "@/lib/import";
import { saveActivities } from "@/lib/import/save";

const BASE = "https://intervals.icu/api/v1";
const day = (d: Date) => d.toISOString().slice(0, 10);

/** Historique GPS : jusqu'où on remonte, et par fenêtres de combien de jours. */
export const HISTORY_YEARS = 3;
export const HISTORY_WINDOW_DAYS = 60;
/** Même sortie dans Pulse et sur Intervals : départ à 90 s près (comme lib/import/save.ts). */
const SAME_START_MS = 90e3;

type IntervalsActivity = { id: string; file_type?: string | null; start_date?: string | null; start_date_local?: string | null; type?: string | null; trainer?: boolean | null };

export type SyncStats = { found: number; withFile: number; saved: number; duplicates: number; backfilled: number; skipped: number; known: number; errors: string[] };

function headers() {
  const key = process.env.INTERVALS_API_KEY?.trim();
  if (!key) throw new Error("INTERVALS_API_KEY manquante dans Vercel");
  return { Authorization: "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64") };
}

async function list(h: Record<string, string>, oldest: Date, newest: Date) {
  const r = await fetch(`${BASE}/athlete/0/activities?oldest=${day(oldest)}&newest=${day(newest)}`, { headers: h, signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) throw new Error("Clé Intervals.icu refusée");
  if (!r.ok) throw new Error(`Intervals.icu a répondu ${r.status}`);
  return (await r.json()) as IntervalsActivity[];
}

/** Départ UTC d'une activité Intervals (start_date est en UTC ; sinon on ne sait pas la dater précisément). */
const startOf = (a: IntervalsActivity) => {
  const t = a.start_date ? Date.parse(a.start_date.endsWith("Z") || /[+-]\d\d:?\d\d$/.test(a.start_date) ? a.start_date : a.start_date + "Z") : NaN;
  return Number.isFinite(t) ? t : null;
};
const indoor = (a: IntervalsActivity) => !!a.trainer || /^Virtual/i.test(a.type ?? "");

async function fetchAndSave(uid: string, h: Record<string, string>, a: IntervalsActivity, out: SyncStats) {
  const f = await fetch(`${BASE}/activity/${a.id}/file`, { headers: h, signal: AbortSignal.timeout(30000) });
  if (!f.ok) throw new Error(`fichier indisponible (${f.status})`);
  const bytes = new Uint8Array(await f.arrayBuffer());
  const gz = bytes[0] === 0x1f && bytes[1] === 0x8b; // le fichier peut arriver compressé ou déjà décompressé
  const act = await parseOne(`${a.id}.${a.file_type}${gz ? ".gz" : ""}`, bytes);
  const res = await saveActivities(uid, [act]);
  out.saved += res.saved; out.duplicates += res.duplicates; out.backfilled += res.backfilled;
}

/**
 * Va chercher sur Intervals.icu (API gratuite) les activités récentes qui ont un fichier original (FIT/GPX/TCX),
 * puis les enregistre dans Pulse via saveActivities (qui lance processActivity : doublons, records, badges, anecdote). Les doublons sont ignorés. Une activité arrivée seulement via Strava n'a pas de fichier : elle est sautée.
 */
export async function syncIntervals(uid: string, days = 3) {
  const h = headers();
  const now = new Date();
  const items = await list(h, new Date(+now - days * 864e5), new Date(+now + 864e5));
  const out: SyncStats = { found: items.length, withFile: 0, saved: 0, duplicates: 0, backfilled: 0, skipped: 0, known: 0, errors: [] };
  for (const a of items) {
    if (!a.file_type) { out.skipped++; continue; }
    out.withFile++;
    try { await fetchAndSave(uid, h, a, out); } catch (e) { out.errors.push(`${a.id} : ${e instanceof Error ? e.message : "erreur"}`); }
  }
  return out;
}

/**
 * Rattrapage de l'historique, une fenêtre de 60 jours à la fois, du plus récent au plus ancien, sans dépasser `deadline`.
 * Saute sans rien télécharger les sorties que Pulse a déjà avec leur trace GPS (ou déjà en intérieur).
 * Renvoie `next` : la date à passer comme `before` à l'appel suivant (null quand l'historique est entièrement parcouru).
 */
export async function syncIntervalsHistory(uid: string, before: Date, deadline: number) {
  const h = headers();
  const cutoff = new Date(Date.now() - HISTORY_YEARS * 365 * 864e5);
  const oldest = new Date(Math.max(+cutoff, +before - HISTORY_WINDOW_DAYS * 864e5));
  const items = (await list(h, oldest, before))
    .map((a) => ({ a, t: startOf(a) }))
    .filter(({ t }) => t == null || t < +before) // `newest` est un jour entier : on écarte ce qui a déjà été traité
    .sort((x, y) => (y.t ?? 0) - (x.t ?? 0));

  const known = await prisma.activity.findMany({
    where: { userId: uid, startedAt: { gte: new Date(+oldest - 864e5), lte: new Date(+before + 864e5) } },
    select: { startedAt: true, polyline: true },
  });
  const have = (t: number | null, a: IntervalsActivity) =>
    t != null && known.some((k) => Math.abs(+k.startedAt - t) <= SAME_START_MS && (!!k.polyline || indoor(a)));

  const out: SyncStats = { found: items.length, withFile: 0, saved: 0, duplicates: 0, backfilled: 0, skipped: 0, known: 0, errors: [] };
  let handled = 0;
  for (const { a, t } of items) {
    if (handled > 0 && Date.now() > deadline) {
      // Plus de temps : on reprendra à cette sortie (le +1 ms la garde dans la fenêtre suivante).
      return { ...out, next: new Date((t ?? +oldest) + 1).toISOString(), done: false };
    }
    handled++;
    if (!a.file_type) { out.skipped++; continue; }
    if (have(t, a)) { out.known++; continue; }
    out.withFile++;
    try { await fetchAndSave(uid, h, a, out); } catch (e) { out.errors.push(`${a.id} : ${e instanceof Error ? e.message : "erreur"}`); }
  }
  const done = +oldest <= +cutoff;
  return { ...out, next: done ? null : oldest.toISOString(), done };
}
