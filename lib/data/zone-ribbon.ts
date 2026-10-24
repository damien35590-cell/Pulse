import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getZones } from "@/lib/data/zones";
import { REF_TOLERANCE, refsChange, zoneRibbon, type Ribbon, type RibbonRefs, type RibbonSource } from "@/lib/art/zone-ribbon";
import { buildStream, type StreamData } from "@/lib/stream";
import { isValidVma } from "@/lib/training/vma";
import { refreshEstimatedHrMax, type HrMaxRefresh } from "@/lib/physio/hr-max";
import type { TrackPoint } from "@/lib/import/types";

/** Seuils nécessaires au ruban : FC max (saisie, sinon estimée) et FTP comme sur la fiche (getZones), VMA du programme de course. */
export type RibbonZones = { hrMax: number | null; ftp: number | null; vma: number | null };

/** La VMA enregistrée (dernière mesure, test ou saisie), pas l'estimation d'après un record : elle ne bouge que quand l'utilisateur la change. Null sans VMA. */
export async function getStoredVma(userId: string): Promise<number | null> {
  const m = await prisma.athleteMetric.findFirst({ where: { userId, type: "VMA_KMH" }, orderBy: { measuredAt: "desc" }, select: { value: true } });
  return m && isValidVma(m.value) ? m.value : null;
}

export async function getRibbonZones(userId: string): Promise<RibbonZones> {
  const [z, vma] = await Promise.all([getZones(userId), getStoredVma(userId)]);
  return { hrMax: z.hrMax, ftp: z.ftp, vma };
}

/**
 * Ruban de zones d'une activité, calculé à partir de sa série à 1 Hz ; à défaut de série (séance d'avant l'arrivée des séries),
 * à partir de la trace compactée, comme la fiche pour la FC. Pour une course, la trace sert aussi à l'allure quand la FC ne suffit pas.
 * Null sans FC, puissance ni allure exploitable, ou sans seuil. N'écrit rien.
 * `zones` : à passer quand on traite plusieurs activités du même utilisateur.
 */
export async function computeZoneRibbon(activityId: string, zones?: RibbonZones): Promise<Ribbon | null> {
  const a = await prisma.activity.findUnique({ where: { id: activityId }, select: { userId: true, type: true, raceEvent: { select: { id: true } }, stream: { select: { data: true } } } });
  if (!a) return null;
  const run = a.type === "RUN", ride = a.type === "RIDE" || a.type === "EBIKE";
  let st = (a.stream?.data ?? null) as StreamData | null;
  let points: TrackPoint[] | undefined;
  if (!st || run) {
    const t = await prisma.activity.findUnique({ where: { id: activityId }, select: { trackPoints: true } });
    const track = Array.isArray(t?.trackPoints) ? (t.trackPoints as unknown as TrackPoint[]) : [];
    if (!st) st = buildStream(track);
    if (run) points = track;
  }
  if (!st && !points?.length) return null;
  const r = zoneRibbon({ hr: st?.hr, power: st?.power, points }, zones ?? (await getRibbonZones(a.userId)), { ride, run });
  // Une course (jour J rattaché) n'est pas une séance d'intervalles, même avec des relances.
  return r?.interval && a.raceEvent ? { ...r, interval: { is: false, reps: 0 } } : r;
}

/** Enregistre le ruban, sa source et son seuil (tout à null quand il n'y a pas de ruban) et date le calcul. */
export const writeRibbon = (activityId: string, r: Ribbon | null) =>
  prisma.activity.update({
    where: { id: activityId },
    data: { zoneRibbon: r?.segments ?? Prisma.DbNull, zoneRibbonSource: r?.source ?? null, zoneRibbonRef: r?.ref ?? null, isInterval: r?.interval?.is ?? null, intervalReps: r?.interval?.reps ?? null, zoneRibbonAt: new Date() },
  });

/** Calcule et enregistre le ruban. Renvoie le nombre de tronçons (0 = pas de ruban). */
export async function refreshZoneRibbon(activityId: string, zones?: RibbonZones): Promise<number> {
  const r = await computeZoneRibbon(activityId, zones);
  await writeRibbon(activityId, r);
  return r?.segments.length ?? 0;
}

// ───────── Rattrapage et recalcul ─────────
/** Plafond de sécurité d'un passage ; en pratique c'est l'échéance de temps qui borne la tâche de nuit. */
export const BACKFILL_CAP = 2000;
const DEFAULT_LIMIT = 50;
/** Un ruban d'allure dont l'activité a pourtant une FC (et qui n'a pas pu passer en FC : trop de trous) n'est réessayé qu'après ce délai. */
const PACE_HR_RETRY_DAYS = 7;
const ZONE_REF: Record<RibbonSource, keyof RibbonZones> = { hr: "hrMax", power: "ftp", pace: "vma" };

export type BackfillStats = { examined: number; ribbons: number; none: number; errors: number; bySource: Record<RibbonSource, number>; timedOut: boolean };

/**
 * Activités dont le ruban est à (re)calculer, les plus récentes d'abord :
 * - jamais calculé ou invalidé (zoneRibbonAt vide), avec une série ou une trace à lire, ou un ruban d'avant le suivi de source ;
 * - calculé avec un seuil qui a bougé depuis (FC max ≥ 2 bpm, FTP ≥ 2 W, VMA), ou dont le seuil a disparu ;
 * - ruban d'allure alors que l'activité a maintenant une FC, si une FC max est connue.
 * Une activité traitée sort de la sélection (ruban daté, seuil à jour) : le rattrapage est idempotent et converge.
 */
export async function pendingRibbonIds(userId: string, zones: RibbonZones, limit: number, skip: string[]): Promise<string[]> {
  const stale = (src: RibbonSource) => {
    const v = zones[ZONE_REF[src]];
    return v == null
      ? Prisma.sql`a."zoneRibbonSource" = ${src}`
      : Prisma.sql`(a."zoneRibbonSource" = ${src} AND abs(a."zoneRibbonRef" - ${v}) >= ${REF_TOLERANCE[src]})`;
  };
  const retryBefore = new Date(Date.now() - PACE_HR_RETRY_DAYS * 864e5);
  const hrNow = zones.hrMax == null
    ? Prisma.sql`FALSE`
    : Prisma.sql`(a."zoneRibbonSource" = 'pace' AND a."zoneRibbonAt" < ${retryBefore} AND EXISTS (SELECT 1 FROM "ActivityStream" s WHERE s."activityId" = a.id
        AND CASE WHEN jsonb_typeof(s.data->'hr') = 'array' THEN jsonb_array_length(s.data->'hr') ELSE 0 END > 0))`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT a.id FROM "Activity" a
    WHERE a."userId" = ${userId} ${skip.length ? Prisma.sql`AND a.id <> ALL(${skip})` : Prisma.empty} AND (
      (a."zoneRibbonAt" IS NULL AND (a."zoneRibbon" IS NOT NULL OR a.type = 'RUN' OR EXISTS (SELECT 1 FROM "ActivityStream" s WHERE s."activityId" = a.id)))
      OR (a."zoneRibbonSource" IN ('hr', 'pace') AND a."isInterval" IS NULL) OR ${stale("hr")} OR ${stale("power")} OR ${stale("pace")} OR ${hrNow}
    )
    ORDER BY a."startedAt" DESC LIMIT ${limit}`;
  return rows.map((r) => r.id);
}

/**
 * Recalcule jusqu'à `limit` rubans en attente (voir pendingRibbonIds). Une erreur sur une activité est journalisée et ne bloque pas les autres.
 * `skip` : activités déjà vues pendant cette série de lots (celles en erreur reviendraient sinon à chaque lot).
 */
export async function backfillRibbons(userId: string, o: { limit?: number; deadline?: number; skip?: string[]; zones?: RibbonZones } = {}): Promise<BackfillStats> {
  const zones = o.zones ?? (await getRibbonZones(userId));
  const out: BackfillStats = { examined: 0, ribbons: 0, none: 0, errors: 0, bySource: { hr: 0, power: 0, pace: 0 }, timedOut: false };
  const skip = o.skip ?? [];
  for (const id of await pendingRibbonIds(userId, zones, o.limit ?? DEFAULT_LIMIT, skip)) {
    if (o.deadline && Date.now() > o.deadline) { out.timedOut = true; break; }
    out.examined++;
    skip.push(id);
    try {
      const r = await computeZoneRibbon(id, zones);
      await writeRibbon(id, r);
      if (r) { out.ribbons++; out.bySource[r.source]++; } else out.none++;
    } catch (e) {
      out.errors++;
      console.error(`[ruban] ${id}`, e);
    }
  }
  return out;
}

const running = new Set<string>();
const BACKGROUND_BATCH = 25, BACKGROUND_MAX_BATCHES = 40;

/**
 * Recalcul par lots en arrière-plan, sans attendre : la requête qui l'a déclenché répond tout de suite. Un seul à la fois par utilisateur.
 * Sur un hébergement qui fige le processus après la réponse (Vercel), il peut s'arrêter en route ; ce n'est pas grave, la sélection
 * repart de l'état enregistré et la tâche de nuit (/api/cron/sync-intervals) termine le travail.
 */
export function refreshRibbonsInBackground(userId: string): void {
  if (running.has(userId)) return;
  running.add(userId);
  void (async () => {
    const skip: string[] = [];
    try {
      for (let i = 0; i < BACKGROUND_MAX_BATCHES; i++) {
        const r = await backfillRibbons(userId, { limit: BACKGROUND_BATCH, skip });
        if (r.examined < BACKGROUND_BATCH) break;
      }
    } catch (e) {
      console.error("[ruban] recalcul en arrière-plan", e);
    } finally {
      running.delete(userId);
    }
  })();
}

/**
 * À appeler après un changement de seuil (FC max saisie ou estimée, FTP, VMA) : si l'écart compte (refsChange), lance le recalcul
 * par lots des rubans concernés (`background: false` pour laisser l'appelant s'en charger, comme la tâche de nuit).
 * Un seuil qui apparaît rouvre aussi les activités restées sans ruban faute de seuil.
 * Ne lève jamais : un échec ici ne doit pas faire échouer l'enregistrement du seuil. Renvoie vrai si des rubans sont à recalculer.
 */
export async function onThresholdsChange(userId: string, before: RibbonRefs, after: RibbonRefs, o: { background?: boolean } = {}): Promise<boolean> {
  try {
    const { stale, appeared } = refsChange(before, after);
    if (!stale.length && !appeared) return false;
    if (appeared) await prisma.activity.updateMany({ where: { userId, zoneRibbon: { equals: Prisma.DbNull }, zoneRibbonAt: { not: null } }, data: { zoneRibbonAt: null } });
    if (o.background !== false) refreshRibbonsInBackground(userId);
    return true;
  } catch (e) {
    console.error("[ruban] changement de seuil", e);
    return false;
  }
}

/**
 * Rafraîchit la FC max estimée (rien si elle est saisie) puis signale le changement aux rubans. Utilisée par la tâche de nuit
 * (`background: false`, elle recalcule elle-même) et par Vous › Seuils quand la saisie est effacée.
 */
export async function refreshHrMaxEstimate(userId: string, o: { background?: boolean } = {}): Promise<HrMaxRefresh & { ribbonsStale: boolean }> {
  const r = await refreshEstimatedHrMax(userId);
  const ribbonsStale = r.skipped ? false : await onThresholdsChange(userId, { hrMax: r.before }, { hrMax: r.after }, o);
  return { ...r, ribbonsStale };
}
