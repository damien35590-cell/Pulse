import type { SessionKind, SessionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/dates";

const TZ = "Europe/Paris";

export type CalSession = {
  id: string; date: string; title: string; kind: SessionKind; status: SessionStatus; isKey: boolean;
  /** Durée réelle de la sortie liée, sinon durée prévue. */
  durationS: number | null;
  /** Sortie qui valide la séance : elle n'apparaît pas une seconde fois dans les activités du jour. */
  activityId: string | null;
};
export type CalRace = { id: string; date: string; name: string; sport: string; status: "REGISTERED" | "COMPLETED" | "DNS" | "DNF" };
export type CalActivity = { id: string; date: string; type: "RUN" | "WORKOUT"; title: string; durationS: number };
export type CalendarData = { from: string; to: string; sessions: CalSession[]; races: CalRace[]; activities: CalActivity[] };

/**
 * Séances du programme course en cours (actif ou en pause, pas les anciens), courses et activités (RUN, WORKOUT) entre deux jours
 * YYYY-MM-DD inclus. Une sortie qui valide une séance n'est comptée qu'une fois : sur la séance. Une requête par source.
 */
export async function getCalendar(userId: string, from: string, to: string): Promise<CalendarData> {
  const lo = new Date(`${from}T00:00:00Z`), hi = new Date(`${to}T23:59:59Z`);
  // Marge autour de la période pour les instants : le tri final se fait sur le jour de Paris.
  const aLo = new Date(+lo - 864e5), aHi = new Date(+hi + 864e5);
  const [sessions, races, activities] = await Promise.all([
    prisma.plannedSession.findMany({
      where: { userId, sport: "RUN", date: { gte: lo, lte: hi }, program: { status: { in: ["ACTIVE", "PAUSED"] } } },
      orderBy: [{ date: "asc" }, { orderInWeek: "asc" }],
      select: {
        id: true, date: true, title: true, kind: true, status: true, isKeySession: true, plannedDurationS: true,
        completedActivityId: true, completedActivity: { select: { movingTimeS: true } },
      },
    }),
    prisma.raceEvent.findMany({ where: { userId, date: { gte: aLo, lte: aHi } }, orderBy: { date: "asc" }, select: { id: true, date: true, name: true, eventName: true, sport: true, status: true } }),
    prisma.activity.findMany({
      where: { userId, type: { in: ["RUN", "WORKOUT"] }, startedAt: { gte: aLo, lte: aHi } }, orderBy: { startedAt: "asc" },
      select: { id: true, startedAt: true, type: true, title: true, movingTimeS: true },
    }),
  ]);
  const inRange = (k: string) => k >= from && k <= to;
  const linked = new Set(sessions.map((s) => s.completedActivityId).filter((id): id is string => !!id));
  return {
    from, to,
    sessions: sessions.map((s) => ({
      id: s.id, date: s.date.toISOString().slice(0, 10), title: s.title, kind: s.kind, status: s.status, isKey: s.isKeySession,
      durationS: s.completedActivity?.movingTimeS ?? s.plannedDurationS, activityId: s.completedActivityId,
    })),
    races: races.map((r) => ({ id: r.id, date: dayKey(r.date, TZ), name: r.eventName ?? r.name, sport: r.sport, status: r.status })).filter((r) => inRange(r.date)),
    activities: activities.filter((a) => !linked.has(a.id)).map((a) => ({ id: a.id, date: dayKey(a.startedAt, TZ), type: a.type as "RUN" | "WORKOUT", title: a.title, durationS: a.movingTimeS })).filter((a) => inRange(a.date)),
  };
}
