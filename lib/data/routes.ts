import type { SuggestedRoute } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bikeSpeed, HISTORY_DAYS, runPace } from "@/lib/routes/estimate";
import type { RoutePoi } from "@/lib/routes/poi";
import type { RouteWeather } from "@/lib/weather/rules";

/** Boucle telle que l'affiche l'interface (sérialisable : passe du serveur au client). */
export type RouteView = {
  id: string;
  sport: "RUN" | "RIDE";
  variant: "road" | "trail" | null;
  label: string;
  why: string;
  minutes: number;
  estMinutes: number;
  distanceM: number;
  ascentM: number;
  polyline: string;
  elevation: number[];
  pois: RoutePoi[];
  /** Météo prévue au départ choisi lors de la recherche ; absente sans Open-Meteo. */
  weather?: RouteWeather | null;
  saved: boolean;
  createdAt: string;
};

export const toRouteView = (r: SuggestedRoute): RouteView => ({
  id: r.id, sport: r.sport === "RIDE" ? "RIDE" : "RUN", variant: r.variant === "trail" ? "trail" : r.variant === "road" ? "road" : null,
  label: r.label, why: r.why, minutes: r.minutes, estMinutes: r.estMinutes, distanceM: r.distanceM, ascentM: r.ascentM,
  polyline: r.polyline, elevation: (r.elevation as number[]) ?? [], pois: (r.pois as RoutePoi[]) ?? [],
  weather: (r.weather as RouteWeather | null) ?? null, saved: r.saved, createdAt: r.createdAt.toISOString(),
});

/** Page /itineraires : domicile, allure et vitesse retenues, boucles gardées. */
export async function getRoutePlanner(userId: string) {
  const since = new Date(Date.now() - HISTORY_DAYS * 864e5);
  const [user, acts, saved, habitRows] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { homeLat: true, homeLng: true } }),
    prisma.activity.findMany({
      where: { userId, type: { in: ["RUN", "RIDE"] }, startedAt: { gte: since } },
      select: { type: true, startedAt: true, distanceM: true, movingTimeS: true, source: true, dedupeKey: true, startLat: true, title: true },
    }),
    prisma.suggestedRoute.findMany({ where: { userId, saved: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.habitMap.findMany({ where: { userId }, select: { sport: true, traces: true, classics: true, junctions: true } }),
  ]);
  const habit = (sport: "RUN" | "RIDE") => {
    const h = habitRows.find((x) => x.sport === sport);
    return h ? { traces: h.traces, classics: ((h.classics as unknown[]) ?? []).length, junctions: ((h.junctions as unknown[]) ?? []).length } : null;
  };
  return {
    home: user?.homeLat != null && user.homeLng != null ? { lat: user.homeLat, lng: user.homeLng } : null,
    run: runPace(acts),
    ride: bikeSpeed(acts),
    saved: saved.map(toRouteView),
    habits: { RUN: habit("RUN"), RIDE: habit("RIDE") },
  };
}

export async function getRoute(userId: string, id: string) {
  const r = await prisma.suggestedRoute.findFirst({ where: { id, userId } });
  return r && toRouteView(r);
}
