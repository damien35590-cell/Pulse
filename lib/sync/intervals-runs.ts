import { revalidatePath } from "next/cache";
import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { processActivity } from "@/lib/pipeline/post-import";
import { BASE } from "@/lib/sync/intervals";

const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"] as const;
type RunType = (typeof RUN_TYPES)[number];

/** Champs utiles de GET /athlete/{id}/activities. */
type IntervalsActivity = {
  id: string;
  type?: string | null;
  name?: string | null;
  source?: string | null; // "STRAVA", "GARMIN_CONNECT", "UPLOAD"…
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
  _note?: string | null; // présent sur les coquilles vides Strava que l'API filtre
};
type IntervalsRun = IntervalsActivity & { type: RunType };

export type RunSyncStats = {
  found: number; runs: number; created: number; updated: number;
  withFile: number; stubs: number; duplicates: number; errors: string[];
};

const day = (d: Date) => d.toISOString().slice(0, 10);
const int = (n: number | null | undefined) => (n != null && Number.isFinite(n) && n > 0 ? Math.round(n) : null);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isRun = (a: IntervalsActivity): a is IntervalsRun => (RUN_TYPES as readonly string[]).includes(a.type ?? "");

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
 * Cookie de session SEUL : avec la clé API (Basic), Intervals.icu traite la requête comme un accès API
 * et renvoie des coquilles vides pour les sorties Strava (`_note`).
 */
const authHeaders = (cookie: string): Record<string, string> => ({ Cookie: `i=${cookie}`, Accept: "application/json" });

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
  const now = Date.now();
  const oldest = day(new Date(now - days * 864e5));
  const newest = day(new Date(now + 864e5));

  const res = await fetch(`${BASE}/athlete/${encodeURIComponent(athleteId)}/activities?oldest=${oldest}&newest=${newest}`, {
    headers: authHeaders(cookie),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403) throw new Error(`Intervals.icu refuse l'accès (${res.status}) : cookie « i » expiré, reconnecte-toi sur intervals.icu et remplace INTERVALS_SESSION_COOKIE`);
  if (!res.ok) throw new Error(`Intervals.icu a répondu ${res.status}`);

  const body: unknown = await res.json();
  if (!Array.isArray(body)) throw new Error("Réponse Intervals.icu inattendue (tableau attendu)");
  const items = body as IntervalsActivity[];

  const out: RunSyncStats = {
    found: items.length, runs: 0, created: 0, updated: 0,
    withFile: 0, stubs: items.filter((a) => a._note != null).length, duplicates: 0, errors: [],
  };

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
    const source = a.source === "STRAVA" ? "strava" : "intervals"; // "strava" + id Strava = même clé que l'import d'archive
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
