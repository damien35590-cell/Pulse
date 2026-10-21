/** Recherche complète : profil → boucles ORS → notation OSM et météo → 3 boucles enregistrées. Côté serveur uniquement. */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encodePolyline } from "@/lib/polyline";
import { buildProfile, HISTORY_DAYS, type BikeVariant, type RouteSport } from "./estimate";
import { generateCandidates, RoutingError, type LatLng } from "./generate";
import { loadLit, loadOsm } from "./overpass";
import { bboxOfRoutes, indexOsm, pickThree, projection, scoreRoute, SegIndex, shareNear, whyText } from "./score";
import { reverseSpans, sessionFit, SESSION_PICK, STRAIGHT_MIN_M, type RunSession, type SessionFit } from "./session-fit";
import { toRouteView, type RouteView } from "@/lib/data/routes";
import { getRideWeather, type RideWeather } from "@/lib/weather/open-meteo";
import { nightInfo, shouldReverse, weatherAdjust, type RouteWeather } from "@/lib/weather/rules";
import { loadHabitIndex } from "@/lib/habits/build";
import { familiarity, type LL } from "@/lib/habits/grid";
import { classicLabel, classicVariants, classicWhy, familiarText, habitBonus, type ClassicCandidate, type HabitMode } from "@/lib/habits/variants";
import type { Candidate } from "./generate";

export type SuggestInput = {
  sport: RouteSport; variant?: BikeVariant; minutes: number; start: LatLng; startISO?: string; habit?: HabitMode;
  /** Course : type de séance (fractionné, sortie longue, récup) ; « normal » ou absent = classement habituel. */
  session?: RunSession;
};
export type SuggestResult = { routes: RouteView[]; note?: string; weather: RideWeather | null };

/** Suggestions non gardées conservées quelques jours (historique de la page), puis supprimées. */
const KEEP_UNSAVED_DAYS = 7;
/** Un échantillon compte comme éclairé à moins de 20 m d'une voie lit=yes. */
const LIT_NEAR_M = 20;

export async function suggestRoutes(userId: string, input: SuggestInput, deadline: number): Promise<SuggestResult> {
  const { sport, minutes, start } = input, variant = sport === "RIDE" ? input.variant ?? "road" : undefined;
  const session: RunSession = sport === "RUN" ? input.session ?? "normal" : "normal";
  const startISO = input.startISO ?? new Date().toISOString();
  // Météo en parallèle du tracé : elle ne bloque jamais la recherche.
  const weatherP = getRideWeather(start.lat, start.lng, startISO, minutes);
  const since = new Date(Date.now() - HISTORY_DAYS * 864e5);
  const acts = await prisma.activity.findMany({
    where: { userId, type: { in: ["RUN", "RIDE"] }, startedAt: { gte: since } },
    select: { type: true, startedAt: true, distanceM: true, movingTimeS: true, source: true, dedupeKey: true, startLat: true, title: true },
  });
  const profile = buildProfile(sport, variant, acts);
  const mode: HabitMode = input.habit ?? "balanced";
  const habits = await loadHabitIndex(userId, sport).catch(() => null);

  // L'analyse OSM et l'écriture en base ont besoin d'environ 15 s : ORS s'arrête avant.
  // Tes classiques (sauf en Découverte) sont adaptés en même temps que les boucles ORS sont tracées.
  const [gen, classics] = await Promise.all([
    generateCandidates({ start, profile, minutes, deadline: deadline - 15_000 }),
    habits && mode !== "discover"
      ? classicVariants({ classics: habits.classics, junctions: habits.junctions, heat: habits.heat, profile, minutes, start, mode, deadline: deadline - 15_000 }).catch(() => [] as ClassicCandidate[])
      : Promise.resolve([] as ClassicCandidate[]),
  ]);
  if (!gen.candidates.length && !classics.length) {
    if (gen.rateLimited) throw new RoutingError("OpenRouteService limite les requêtes pour l'instant. Réessaie dans une minute.", 429);
    const closest = gen.all.sort((a, b) => Math.abs(a.estMinutes - minutes) - Math.abs(b.estMinutes - minutes))[0];
    throw new RoutingError(
      closest
        ? `Aucune boucle ne tient dans ${minutes} min ±10 % depuis ce départ (la plus proche fait ${Math.round(closest.estMinutes)} min). Essaie une autre durée ou un autre départ.`
        : "OpenRouteService n'a proposé aucune boucle depuis ce départ. Réessaie dans un instant.",
      422,
    );
  }

  // Vent fort : chaque boucle est parcourue dans le sens qui met le vent de face à l'aller.
  const w = await weatherP;
  const classic = classics[0] as (Candidate & { classic?: ClassicCandidate["classic"] }) | undefined;
  const candidates = [...gen.candidates, ...(classic ? [classic] : [])].map((c: Candidate & { classic?: ClassicCandidate["classic"] }) =>
    w && shouldReverse(c.coords, w, sport)
      ? { ...c, coords: [...c.coords].reverse(), bigRoadSpans: c.bigRoadSpans && reverseSpans(c.bigRoadSpans, c.coords.length), reversed: true }
      : { ...c, reversed: false },
  );

  const bbox = bboxOfRoutes(candidates.map((c) => c.coords));
  const night = !!w && candidates.some((c) => nightInfo(w, c.estMinutes)?.night);
  const [osm, lit] = await Promise.all([loadOsm(bbox, deadline - 4000), night ? loadLit(bbox, deadline - 4000) : null]);
  const idx = osm.data ? indexOsm(osm.data, start.lat) : null;
  const litIdx = lit ? lit.reduce((ix, l, i) => ix.add(l, i), new SegIndex(projection(start.lat))) : null;

  const weatherOf = new Map<object, RouteWeather>();
  const fitOf = new Map<object, SessionFit>();
  const scored = candidates.map((c) => {
    const r = scoreRoute(c, idx, sport, minutes);
    if (w) {
      const litShare = litIdx ? shareNear(r.samples, litIdx, LIT_NEAR_M) : null;
      const adj = weatherAdjust(w, sport, {
        coords: r.coords, estMinutes: r.estMinutes, forest: r.scores.kinds.forest, unpaved: r.scores.unpaved,
        lit: litShare, waterPoints: r.scores.waterPoints, reversed: c.reversed,
      });
      r.scores.weather = Math.round(adj.bonus * 1000) / 1000;
      r.scores.lit = litShare;
      r.scores.global += adj.bonus;
      weatherOf.set(r, adj.weather);
    }
    // Habitudes : part du tracé sur tes chemins connus, favorisée (Habitude) ou évitée (Découverte).
    if (habits) {
      r.scores.familiar = Math.round(familiarity(habits.heat, r.samples.map((x) => [x.lat, x.lng] as LL)) * 1000) / 1000;
      r.scores.global += habitBonus(mode, r.scores.familiar);
    }
    // Les cimetières (robinet probable) ne servent qu'à la sortie longue : ailleurs, ils ne sont pas signalés.
    if (session !== "long") r.pois = r.pois.filter((p) => p.type !== "cemetery");
    // Séance : ligne droite plate (fractionné), points d'eau (sortie longue), plat et nature (récup).
    const fit = sessionFit(session, {
      coords: r.coords, distanceM: r.distanceM, ascentM: r.ascentM, estMinutes: r.estMinutes, bigRoadSpans: c.bigRoadSpans,
      pois: r.pois, nature: r.scores.nature, unpaved: r.scores.unpaved, bigRoad: r.scores.bigRoad,
    });
    if (fit) {
      r.scores.session = fit.scores;
      r.scores.global += fit.bonus;
      fitOf.set(r, fit);
    }
    return r;
  });
  // Ton classique passe en premier (Habitude, Équilibre), puis la meilleure boucle pour la séance, puis les plus différentes.
  // Fractionné : seules les boucles avec une ligne droite plate comptent, complétées par les autres s'il en manque.
  const fits = (r: object) => fitOf.get(r)?.ok ?? true;
  const mine = scored.find((r) => r.classic && fits(r));
  const others = scored.filter((r) => !r.classic);
  const lead = session !== "normal" ? { label: SESSION_PICK[session], key: (r: object) => fitOf.get(r)?.key ?? 0 } : undefined;
  const first = pickThree(others.filter(fits), mine ? [{ label: classicLabel(mine.classic!), route: mine }] : [], 3, lead);
  const picks = first.length < 3 ? pickThree(others, first) : first;
  const fitCount = picks.filter(({ route }) => fitOf.get(route)?.ok).length;

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
          label,
          why: [
            fitOf.get(r)?.text,
            r.classic ? classicWhy(r.classic) : whyText(r.scores, r.pois, { water: session !== "long" }),
            habits && r.scores.familiar != null && !r.classic ? familiarText(mode, r.scores.familiar) : null,
          ].filter(Boolean).join(" · "),
          scores: r.scores as unknown as Prisma.InputJsonValue,
          pois: r.pois as unknown as Prisma.InputJsonValue,
          weather: (weatherOf.get(r) ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
        },
      }),
    ),
  ]);
  const routes = rows.slice(1).map((r) => toRouteView(r as Parameters<typeof toRouteView>[0]));
  const notes = [
    habits && mode !== "discover" && habits.classics.length && !classic && "Aucun de tes classiques ne part d'ici dans ce temps.",
    session === "intervals" && !fitCount && `Aucune boucle avec une ligne droite plate de ${STRAIGHT_MIN_M} m depuis ce départ : fais tes fractions au temps.`,
    session === "intervals" && fitCount > 0 && fitCount < routes.length && `${fitCount} boucle${fitCount > 1 ? "s" : ""} sur ${routes.length} avec une ligne droite plate de ${STRAIGHT_MIN_M} m.`,
    routes.length < 3 && `Seulement ${routes.length} boucle${routes.length > 1 ? "s" : ""} assez différente${routes.length > 1 ? "s" : ""} dans ce temps.`,
    !osm.data && "OpenStreetMap n'a pas répondu : boucles classées sans le détail nature et curiosités.",
    !w && "Open-Meteo n'a pas répondu : boucles classées sans la météo.",
  ].filter(Boolean);
  return { routes, note: notes.join(" ") || undefined, weather: w };
}
