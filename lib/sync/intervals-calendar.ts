/**
 * Envoie les séances de course à venir du programme actif dans le calendrier Intervals.icu (événements WORKOUT),
 * d'où elles partent vers la montre Garmin (connexion Intervals → Garmin Connect).
 *
 * Idempotent : chaque séance a un external_id stable « pulse-<id> » et l'envoi est un upsert.
 * Les événements « pulse-… » à venir qui ne correspondent plus à une séance à faire (passée, remplacée, programme en pause ou terminé)
 * sont supprimés côté Intervals. Même authentification que lib/sync/intervals.ts (INTERVALS_API_KEY, athlète « 0 » = moi).
 */
import type { RunGeneratorInput, RunWorkoutStructure } from "@/types/training";
import { prisma } from "@/lib/prisma";
import { dayKey, shiftDay } from "@/lib/dates";
import { getCurrentVma } from "@/lib/data/training";
import { DEFAULT_VMA } from "@/lib/training/vma";
import { sessionIdOf, toIntervalsEvent } from "@/lib/training/intervals-workout";
import { BASE, headers } from "./intervals";

const TZ = "Europe/Paris";
/** Fenêtre d'envoi : aujourd'hui + 14 jours. */
export const CALENDAR_DAYS = 14;
/** Fenêtre de ménage : plus large, pour rattraper d'anciens envois (programme remplacé…). */
const CLEANUP_DAYS = 90;

export type CalendarSyncResult = { sent: number; removed: number; syncedAt: string };
type RemoteEvent = { id?: number | string | null; external_id?: string | null };

const utcDay = (key: string) => new Date(`${key}T00:00:00Z`);

/** Appel Intervals.icu avec messages d'erreur lisibles (clé refusée, refus 4xx, panne). */
async function call(path: string, init: { method: string; body?: unknown } = { method: "GET" }) {
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: { ...headers(), ...(init.body !== undefined && { "Content-Type": "application/json" }) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new Error(e instanceof Error && e.name === "TimeoutError" ? "Intervals.icu ne répond pas, réessaie dans un instant." : "Intervals.icu est injoignable.");
  }
  if (r.status === 401 || r.status === 403) throw new Error("Clé Intervals.icu refusée");
  if (!r.ok) {
    const detail = (await r.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 200);
    throw new Error(r.status < 500 ? `Intervals.icu a refusé l'envoi (${r.status})${detail ? ` : ${detail}` : ""}` : `Intervals.icu a répondu ${r.status}, réessaie plus tard.`);
  }
  return r;
}

export async function syncProgramToIntervals(userId: string, days = CALENDAR_DAYS, now = new Date()): Promise<CalendarSyncResult> {
  if (!process.env.INTERVALS_API_KEY?.trim()) throw new Error("Clé Intervals.icu absente : ajoute INTERVALS_API_KEY dans Vercel.");

  const today = dayKey(now, TZ), last = shiftDay(today, days);
  const program = await prisma.program.findFirst({
    where: { userId, sport: "RUN", status: "ACTIVE" }, orderBy: { createdAt: "desc" }, select: { id: true, generatorInput: true },
  });

  // À envoyer : séances à faire du programme actif, de aujourd'hui à J+14. Les séances en retard (date passée) ne partent pas.
  const planned = program
    ? await prisma.plannedSession.findMany({
        where: { userId, programId: program.id, sport: "RUN", status: "PLANNED", date: { gte: utcDay(today), lte: utcDay(last) } },
        orderBy: [{ date: "asc" }, { orderInWeek: "asc" }],
        select: { id: true, date: true, title: true, description: true, structure: true, plannedDurationS: true },
      })
    : [];
  // À ne pas supprimer : séances déjà faites aujourd'hui ou plus tard (leur événement reste, Intervals le rapproche de l'activité).
  const done = await prisma.plannedSession.findMany({ where: { userId, sport: "RUN", status: { in: ["COMPLETED", "PARTIAL"] }, date: { gte: utcDay(today) } }, select: { id: true } });
  const keep = new Set([...planned, ...done].map((s) => s.id));

  let sent = 0;
  if (planned.length) {
    const vma = (await getCurrentVma(userId))?.vmaKmh ?? (program?.generatorInput as RunGeneratorInput | null)?.vmaKmh ?? DEFAULT_VMA.vmaKmh;
    const events = planned.map((s) => toIntervalsEvent({
      id: s.id, date: s.date.toISOString().slice(0, 10), title: s.title, description: s.description,
      structure: s.structure as RunWorkoutStructure | null, plannedDurationS: s.plannedDurationS,
    }, vma));

    const res = await call("/athlete/0/events/bulk?upsert=true", { method: "POST", body: events });
    const created = (await res.json().catch(() => [])) as RemoteEvent[];
    const idOf = new Map<string, string>();
    for (const e of Array.isArray(created) ? created : []) if (e.external_id && e.id != null) idOf.set(e.external_id, String(e.id));
    const at = new Date();
    await prisma.$transaction(planned.map((s) => prisma.plannedSession.update({
      where: { id: s.id }, data: { intervalsEventId: idOf.get(`pulse-${s.id}`) ?? `pulse-${s.id}`, intervalsSyncedAt: at },
    })));
    sent = events.length;
  }

  // Ménage : événements « pulse-… » à venir sans séance à faire correspondante.
  const remote = (await (await call(`/athlete/0/events?oldest=${today}&newest=${shiftDay(today, CLEANUP_DAYS)}`)).json().catch(() => [])) as RemoteEvent[];
  const stale = (Array.isArray(remote) ? remote : []).filter((e) => {
    const sid = sessionIdOf(e.external_id);
    return sid && e.id != null && !keep.has(sid);
  });
  const failures: string[] = [];
  const removedIds: string[] = [];
  for (const e of stale) {
    try { await call(`/athlete/0/events/${encodeURIComponent(String(e.id))}`, { method: "DELETE" }); removedIds.push(sessionIdOf(e.external_id)!); }
    catch (err) { if (/\(404\)/.test(err instanceof Error ? err.message : "")) removedIds.push(sessionIdOf(e.external_id)!); else failures.push(err instanceof Error ? err.message : "erreur"); }
  }
  if (removedIds.length) await prisma.plannedSession.updateMany({ where: { id: { in: removedIds }, userId }, data: { intervalsEventId: null, intervalsSyncedAt: null } });
  if (failures.length) throw new Error(`${sent} séance(s) envoyée(s), mais suppression impossible : ${failures[0]}`);

  return { sent, removed: removedIds.length, syncedAt: new Date().toISOString() };
}
