import { revalidatePath } from "next/cache";
import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { processActivity } from "@/lib/pipeline/post-import";

const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"] as const;
type RunType = (typeof RUN_TYPES)[number];

/** Colonnes utiles de l'export CSV /api/athlete/{id}/activities.csv (celui du site, accepté avec le cookie). */
type IntervalsActivity = {
  id: string;
  type?: string | null;
  name?: string | null;
  file_type?: string | null;
  start_date?: string | null; // UTC
  start_date_local?: string | null;
  distance?: number | null; // m
  moving_time?: number | null; // s
  elapsed_time?: number | null; // s
  total_elevation_gain?: number | null; // m
  average_heartrate?: number | null;
  max_heartrate?: number | null;
  calories?: number | null;
};
type IntervalsRun = IntervalsActivity & { type: RunType };

export type RunSyncStats = {
  found: number; runs: number; created: number; updated: number;
  withFile: number; duplicates: number; errors: string[];
};

const CSV_URL = (athleteId: string) => `https://intervals.icu/api/athlete/${encodeURIComponent(athleteId)}/activities.csv`;
const int = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isRun = (a: IntervalsActivity): a is IntervalsRun => (RUN_TYPES as readonly string[]).includes(a.type ?? "");

/** CSV (RFC 4180) : champs entre guillemets, virgules et guillemets doublés à l'intérieur, fins de ligne CRLF ou LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

const num = (s: string | undefined) => {
  if (s == null || s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Lignes du CSV → activités (colonnes repérées par leur nom d'en-tête). */
export function activitiesFromCsv(text: string): IntervalsActivity[] {
  const [head, ...rows] = parseCsv(text);
  if (!head) return [];
  const col = new Map(head.map((h, i) => [h.trim(), i]));
  if (!col.has("id") || !col.has("type")) throw new Error("Export CSV Intervals.icu inattendu (colonnes id/type absentes)");
  const str = (r: string[], k: string) => { const i = col.get(k); const v = i == null ? "" : (r[i] ?? "").trim(); return v || null; };
  const n = (r: string[], k: string) => { const i = col.get(k); return i == null ? null : num(r[i]); };
  return rows.map((r) => ({
    id: str(r, "id") ?? "",
    type: str(r, "type"),
    name: str(r, "name"),
    file_type: str(r, "file_type"),
    start_date: str(r, "start_date"),
    start_date_local: str(r, "start_date_local"),
    distance: n(r, "distance"),
    moving_time: n(r, "moving_time"),
    elapsed_time: n(r, "elapsed_time"),
    total_elevation_gain: n(r, "total_elevation_gain"),
    average_heartrate: n(r, "average_heartrate"),
    max_heartrate: n(r, "max_heartrate"),
    calories: n(r, "calories"),
  })).filter((a) => a.id);
}

function startOf(a: IntervalsActivity): Date | null {
  const s = a.start_date;
  if (!s) return null;
  const t = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}Z`);
  return Number.isFinite(t) ? new Date(t) : null;
}

/** Valeur du cookie de session web « i » (sans le préfixe « i= »). */
function sessionCookie(): string {
  const raw = process.env.INTERVALS_SESSION_COOKIE?.trim();
  if (!raw) throw new Error("INTERVALS_SESSION_COOKIE manquant dans Vercel");
  return raw.replace(/^i=/, "");
}

/**
 * Cookie de session SEUL. L'API officielle (/api/v1) refuse les cookies et, avec la clé API, ne renvoie que des
 * coquilles vides pour les sorties Strava : on passe par l'export CSV du site, qui les contient en entier.
 */
const authHeaders = (cookie: string): Record<string, string> => ({ Cookie: `i=${cookie}`, Accept: "text/csv" });

/** Id athlète : variable INTERVALS_ATHLETE_ID, sinon lu dans le cookie (« v2_i200227_… » → « i200227 »). */
function athleteIdOf(cookie: string): string {
  const id = process.env.INTERVALS_ATHLETE_ID?.trim() || /^v\d+_(i\d+)_/.exec(cookie)?.[1];
  if (!id) throw new Error("Id athlète Intervals.icu introuvable (INTERVALS_ATHLETE_ID ou cookie « i »)");
  return id;
}

/**
 * Courses (Run, TrailRun, VirtualRun) des `days` derniers jours SANS fichier d'origine (arrivées via Strava) :
 * upsert du résumé dans Activity, puis pipeline (doublons, records, badges, anecdote) pour les nouvelles.
 * Les courses avec fichier restent gérées par syncIntervals (trace GPS complète).
 */
export async function syncIntervalsRuns(uid: string, days = 3): Promise<RunSyncStats> {
  const cookie = sessionCookie();
  const athleteId = athleteIdOf(cookie);
  const since = Date.now() - days * 864e5;

  const res = await fetch(CSV_URL(athleteId), {
    headers: authHeaders(cookie),
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 401 || res.status === 403) throw new Error(`Intervals.icu refuse l'accès (${res.status}) : cookie « i » expiré, reconnecte-toi sur intervals.icu et remplace INTERVALS_SESSION_COOKIE`);
  if (!res.ok) throw new Error(`Intervals.icu a répondu ${res.status}`);

  // Tout l'historique arrive (quelques centaines de lignes) : on garde la fenêtre des `days` derniers jours.
  const items = activitiesFromCsv(await res.text()).filter((a) => (startOf(a)?.getTime() ?? 0) >= since);

  const out: RunSyncStats = { found: items.length, runs: 0, created: 0, updated: 0, withFile: 0, duplicates: 0, errors: [] };

  const runs = items.filter(isRun).filter((a) => {
    if (a.file_type) { out.withFile++; return false; }
    return true;
  });
  out.runs = runs.length;
  if (!runs.length) return out;

  const known = new Set(
    (await prisma.activity.findMany({
      where: { userId: uid, externalId: { in: runs.map((a) => a.id) } },
      select: { source: true, externalId: true },
    })).map((k) => `${k.source}:${k.externalId}`),
  );

  for (const a of runs) {
    const startedAt = startOf(a);
    if (!startedAt) { out.errors.push(`${a.id} : date de départ absente`); continue; }
    // Id numérique = id Strava (même clé que l'import d'archive) ; sinon id propre à Intervals (« i123… »).
    const source = /^\d+$/.test(a.id) ? "strava" : "intervals";
    const summary = {
      distanceM: a.distance ?? 0,
      movingTimeS: int(a.moving_time) ?? 0,
      elapsedTimeS: int(a.elapsed_time),
      elevationGainM: a.total_elevation_gain ?? 0,
      avgHr: int(a.average_heartrate),
      maxHr: int(a.max_heartrate),
      calories: int(a.calories),
    };
    // Mise à jour : jamais d'écrasement par une valeur vide.
    const update = Object.fromEntries(
      Object.entries(summary).filter(([, v]) => v != null && v !== 0),
    ) as Prisma.ActivityUpdateInput;

    try {
      const row = await prisma.activity.upsert({
        where: { userId_source_externalId: { userId: uid, source, externalId: a.id } },
        create: {
          user: { connect: { id: uid } },
          type: ActivityType.RUN,
          title: (a.name?.trim() || "Running").slice(0, 120),
          startedAt,
          source,
          externalId: a.id,
          dedupeKey: `${source}-${a.id}`,
          ...summary,
        },
        update,
        select: { id: true },
      });
      if (known.has(`${source}:${a.id}`)) {
        out.updated++;
      } else {
        out.created++;
        await processActivity(row.id);
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { out.duplicates++; continue; }
      out.errors.push(`${a.id} : ${msg(e)}`);
    }
  }

  if (out.created) { revalidatePath("/"); revalidatePath("/activities"); revalidatePath("/vous"); revalidatePath("/analysis"); }
  return out;
}
