/** Tes classiques adaptés au temps dispo, avec OpenRouteService (côté serveur). La géométrie est dans lib/habits/plan.ts. */
import { prisma } from "@/lib/prisma";
import { decodePolyline } from "@/lib/polyline";
import { estimateMinutes, kmForMinutes, timeError, withinTolerance, type Profile } from "@/lib/routes/estimate";
import { viaRouter, type Candidate, type LatLng } from "@/lib/routes/generate";
import { placeAt } from "@/lib/routes/places";
import { dist, proj, type Heat, type Junction, type LL } from "./grid";
import { CALLS_PER_CLASSIC, detours, MAX_CLASSICS_TRIED, shortcuts, START_NEAR_M, waypointsOf, type ClassicMeta, type HabitMode } from "./plan";
import type { StoredClassic } from "./build";

export { classicLabel, classicWhy, familiarText, habitBonus, HABIT_MODES, type ClassicMeta, type HabitMode } from "./plan";
export type ClassicCandidate = Candidate & { classic: ClassicMeta };

const toLatLng = (ll: LL): LatLng => ({ lat: ll[0], lng: ll[1] });

/** Trace réelle (avec altitude) de la sortie représentative du classique. */
async function realTrace(repId: string, fallback: string): Promise<[number, number, number][]> {
  const a = await prisma.activity.findUnique({ where: { id: repId }, select: { trackPoints: true } });
  const tp = (a?.trackPoints as { lat?: number; lng?: number; ele?: number }[] | null) ?? [];
  const withPos = tp.filter((x) => x.lat != null && x.lng != null);
  if (withPos.length > 1) return withPos.map((x) => [x.lat!, x.lng!, x.ele ?? 0]);
  return decodePolyline(fallback).map(([lat, lng]) => [lat, lng, 0]);
}

/**
 * Au plus une variante par classique (les 2 plus fréquents partant à moins de 600 m du départ), la plus juste en temps.
 * Quelques appels ORS par classique ; un classique qui tient déjà dans le temps n'en coûte aucun.
 */
export async function classicVariants(opts: {
  classics: StoredClassic[]; junctions: Junction[]; heat: Heat | null; profile: Profile; minutes: number; start: LatLng; mode: HabitMode; deadline: number;
}): Promise<ClassicCandidate[]> {
  const { profile, minutes, start, mode } = opts;
  const p = proj(start.lat);
  const near = opts.classics
    .filter((c) => dist(p, [c.start.lat, c.start.lng], [start.lat, start.lng]) <= START_NEAR_M)
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_CLASSICS_TRIED);
  const out: ClassicCandidate[] = [];

  for (const c of near) {
    if (Date.now() > opts.deadline) break;
    const meta = (kind: ClassicMeta["kind"], est: number, viaName: string | null = null, viaJunction = false): ClassicMeta => ({
      classicId: c.id, name: c.name, count: c.count, kind, deltaMin: Math.round(est - estimateMinutes(profile, c.distanceM / 1000, c.ascentM)), viaName, viaJunction, loop: c.loop,
    });
    const est0 = estimateMinutes(profile, c.distanceM / 1000, c.ascentM);
    if (withinTolerance(est0, minutes)) {
      const coords = await realTrace(c.repId, c.polyline);
      out.push({ key: c.id, seed: 0, points: 0, length: c.distanceM, coords, distanceM: c.distanceM, ascentM: c.ascentM, estMinutes: est0, bigRoadPct: 0, unpavedPct: 0, classic: meta("asis", est0) });
      continue;
    }

    const longer = est0 < minutes;
    const climb = c.distanceM ? c.ascentM / (c.distanceM / 1000) : 0;
    const needM = kmForMinutes(profile, Math.abs(minutes - est0), climb) * 1000;
    const { wps, cum } = waypointsOf(p, decodePolyline(c.polyline) as LL[]);
    const router = viaRouter(profile, opts.deadline, CALLS_PER_CLASSIC);
    type Routed = Awaited<ReturnType<typeof router.route>>;
    type Best = { r: NonNullable<Routed>; via: LL | null; junction: boolean };
    let best = null as Best | null;
    const consider = (r: Routed, via: LL | null, junction: boolean) => {
      if (r && (!best || Math.abs(timeError(r.estMinutes, minutes)) < Math.abs(timeError(best.r.estMinutes, minutes)))) best = { r, via, junction };
    };

    if (longer) {
      for (const d of detours(p, wps, needM, opts.junctions, opts.heat, mode)) {
        // Détour en triangle : on quitte le tracé à ce point, on rejoint le suivant.
        const via = [...wps.slice(0, d.at + 1), d.via, ...wps.slice(d.at + 1)].map(toLatLng);
        consider(await router.route(via), d.via, d.junction);
        if (best && withinTolerance(best.r.estMinutes, minutes)) break;
      }
    } else {
      for (const s of shortcuts(p, wps, cum, needM)) {
        consider(await router.route([...wps.slice(0, s.i + 1), ...wps.slice(s.j)].map(toLatLng)), null, false);
        if (best && withinTolerance(best.r.estMinutes, minutes)) break;
      }
    }
    const b = best;
    if (!b || !withinTolerance(b.r.estMinutes, minutes)) continue;
    const viaName = b.via ? (await placeAt(b.via[0], b.via[1]).catch(() => null))?.name ?? null : null;
    out.push({ key: `${c.id}-${longer ? "long" : "court"}`, seed: 0, points: 0, length: b.r.distanceM, ...b.r, classic: meta(longer ? "longer" : "shorter", b.r.estMinutes, viaName, b.junction) });
  }
  return out.sort((a, b) => Math.abs(timeError(a.estMinutes, minutes)) - Math.abs(timeError(b.estMinutes, minutes)) || b.classic.count - a.classic.count);
}

