/** Recherche complète : profil → boucles ORS → notation OSM → 3 boucles enregistrées. Côté serveur uniquement. */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import { buildProfile, HISTORY_DAYS, type BikeVariant, type RouteSport } from "./estimate";
import { generateCandidates, RoutingError, type LatLng } from "./generate";
import { loadOsm } from "./overpass";
import { bboxOfRoutes, indexOsm, pickThree, scoreRoute, whyText } from "./score";
import { toRouteView, type RouteView } from "@/lib/data/routes";

export type SuggestInput = { sport: RouteSport; variant?: BikeVariant; minutes: number; start: LatLng };
export type SuggestResult = { routes: RouteView[]; note?: string };

/** Suggestions non gardées conservées quelques jours (historique de la page), puis supprimées. */
const KEEP_UNSAVED_DAYS = 7;

export async function suggestRoutes(userId: string, input: SuggestInput, deadline: number): Promise<SuggestResult> {
  const { sport, minutes, start } = input, variant = sport === "RIDE" ? input.variant ?? "road" : undefined;
  const since = new Date(Date.now() - HISTORY_DAYS * 864e5);
  const acts = await prisma.activity.findMany({
    where: { userId, type: { in: ["RUN", "RIDE"] }, startedAt: { gte: since } },
    select: { type: true, startedAt: true, distanceM: true, movingTimeS: true, source: true, dedupeKey: true, startLat: true, title: true },
  });
  const profile = buildProfile(sport, variant, acts);

  // L'analyse OSM et l'écriture en base ont besoin d'environ 15 s : ORS s'arrête avant.
  const gen = await generateCandidates({ start, profile, minutes, deadline: deadline - 15_000 });
  if (!gen.candidates.length) {
    if (gen.rateLimited) throw new RoutingError("OpenRouteService limite les requêtes pour l'instant. Réessaie dans une minute.", 429);
    const closest = gen.all.sort((a, b) => Math.abs(a.estMinutes - minutes) - Math.abs(b.estMinutes - minutes))[0];
    throw new RoutingError(
      closest
        ? `Aucune boucle ne tient dans ${minutes} min ±10 % depuis ce départ (la plus proche fait ${Math.round(closest.estMinutes)} min). Essaie une autre durée ou un autre départ.`
        : "OpenRouteService n'a proposé aucune boucle depuis ce départ. Réessaie dans un instant.",
      422,
    );
  }

  const osm = await loadOsm(bboxOfRoutes(gen.candidates.map((c) => c.coords)), deadline - 4000);
  const idx = osm.data ? indexOsm(osm.data, start.lat) : null;
  const scored = gen.candidates.map((c) => scoreRoute(c, idx, sport, minutes));
  const picks = pickThree(scored);

  const old = new Date(Date.now() - KEEP_UNSAVED_DAYS * 864e5);
  const rows = await prisma.$transaction([
    prisma.suggestedRoute.deleteMany({ where: { userId, saved: false, createdAt: { lt: old } } }),
    ...picks.map(({ label, route: r }) =>
      prisma.suggestedRoute.create({
        data: {
          userId, sport, variant: variant ?? null, minutes, startLat: start.lat, startLng: start.lng,
          polyline: encodePolyline(r.coords.map(([lat, lng]) => [lat, lng])),
          elevation: r.coords.map((c) => Math.round(c[2])),
          distanceM: Math.round(r.distanceM), ascentM: r.ascentM, estMinutes: Math.round(r.estMinutes),
          label, why: whyText(r.scores, r.pois),
          scores: r.scores as unknown as Prisma.InputJsonValue,
          pois: r.pois as unknown as Prisma.InputJsonValue,
        },
      }),
    ),
  ]);
  const routes = rows.slice(1).map((r) => toRouteView(r as Parameters<typeof toRouteView>[0]));
  const notes = [
    routes.length < 3 && `Seulement ${routes.length} boucle${routes.length > 1 ? "s" : ""} assez différente${routes.length > 1 ? "s" : ""} dans ce temps.`,
    !osm.data && "OpenStreetMap n'a pas répondu : boucles classées sans le détail nature et curiosités.",
  ].filter(Boolean);
  return { routes, note: notes.join(" ") || undefined };
}
