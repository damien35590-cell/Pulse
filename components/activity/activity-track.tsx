"use client";
import { useMemo, useState } from "react";
import { TopoMapLazy } from "@/components/activity/topo-map-lazy";
import { ElevationChart } from "@/components/activity/elevation-chart";
import type { TrackPoint } from "@/components/activity/interactive-topo-map";

const rad = Math.PI / 180;
const meters = (a: TrackPoint, b: TrackPoint) => {
  const x = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 12742000 * Math.asin(Math.sqrt(x));
};

/**
 * Carte + profil d'altitude d'une activité, qui partagent le curseur : glisser le doigt sur le profil
 * déplace un point sur la carte à la même distance.
 */
export function ActivityTrack({ points, gain }: { points: TrackPoint[]; gain?: number }) {
  const [cursorKm, setCursorKm] = useState<number | null>(null);

  const t = useMemo(() => {
    const km = [0];
    for (let i = 1; i < points.length; i++) km.push(km[i - 1] + meters(points[i - 1], points[i]) / 1000);
    const profile = points.flatMap((p, i) => (p.ele != null ? [{ km: km[i], ele: p.ele }] : []));
    return { km, profile };
  }, [points]);

  // Distance → position : recherche dichotomique dans les distances cumulées, puis interpolation sur le segment.
  const cursor = useMemo((): [number, number] | null => {
    if (cursorKm == null || points.length < 2) return null;
    const km = t.km, target = Math.min(km[km.length - 1], Math.max(0, cursorKm + (t.profile[0]?.km ?? 0)));
    let lo = 0, hi = km.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (km[mid] <= target) lo = mid; else hi = mid; }
    const a = points[lo], b = points[hi], f = km[hi] > km[lo] ? (target - km[lo]) / (km[hi] - km[lo]) : 0;
    return [a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f];
  }, [cursorKm, points, t]);

  return (
    <>
      <TopoMapLazy points={points} cursor={cursor} />
      {t.profile.length > 5 && (
        <section>
          <h2 className="mb-3 font-display text-lg font-bold">Altitude</h2>
          <ElevationChart points={t.profile} gain={gain} onCursor={setCursorKm} />
        </section>
      )}
    </>
  );
}
