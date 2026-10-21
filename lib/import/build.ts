import { Prisma, type ActivityType } from "@prisma/client";
import { encodePolyline } from "@/lib/polyline";
import type { Pt } from "@/lib/geo";
import { buildStream, meanNonZero, sanitizeStream } from "@/lib/stream";
import { powerCurve } from "@/lib/power";
import { compactTrack } from "./track";
import type { ParsedActivity } from "./types";

/** Série à 1 Hz prête à enregistrer (données + courbe de puissance + cadence moyenne), ou null si l'activité n'a ni puissance ni cardio. */
export function prepStream(a: ParsedActivity) {
  const st = sanitizeStream(a.stream) ?? buildStream(a.points ?? []);
  if (!st) return null;
  const cad = meanNonZero(st.cad);
  return {
    data: JSON.parse(JSON.stringify(st)) as Prisma.InputJsonValue,
    curve: st.power.length ? (powerCurve(st.power) as Prisma.InputJsonValue) : undefined,
    avgCad: cad > 0 ? Math.round(cad) : null,
  };
}

export const gpsOf = (a: ParsedActivity): Pt[] => (a.points ?? []).filter((p) => p.lat != null && p.lng != null).map((p) => ({ lat: p.lat!, lng: p.lng!, t: p.t }));

/** Champs d'une nouvelle activité importée (trace simplifiée, points compactés, série 1 Hz). Le rattachement du matériel reste à la charge de l'appelant. */
export function activityCreateData(uid: string, a: ParsedActivity) {
  const gps = gpsOf(a);
  const stride = Math.max(1, Math.ceil(gps.length / 500)), track = compactTrack(a.points ?? [], 900);
  const s = prepStream(a);
  return {
    userId: uid, type: a.type as ActivityType, title: String(a.title || "Activité importée").slice(0, 120), startedAt: new Date(a.startedAt),
    notes: a.notes?.trim() || null,
    distanceM: a.distanceM, movingTimeS: a.movingTimeS, elapsedTimeS: a.elapsedTimeS ?? null, elevationGainM: a.elevationGainM ?? 0,
    avgHr: a.avgHr ? Math.round(a.avgHr) : null, maxHr: a.maxHr ? Math.round(a.maxHr) : null, calories: a.calories ? Math.round(a.calories) : null,
    avgPower: a.avgPower ? Math.round(a.avgPower) : null, maxPower: a.maxPower ? Math.round(a.maxPower) : null,
    startLat: a.startLat ?? null, startLng: a.startLng ?? null,
    polyline: gps.length > 1 ? encodePolyline(gps.filter((_, j) => j % stride === 0).map((p) => [p.lat, p.lng])) : null,
    trackPoints: track.length ? (JSON.parse(JSON.stringify(track)) as Prisma.InputJsonValue) : undefined,
    source: a.source, externalId: a.externalId ?? a.dedupeKey, dedupeKey: a.dedupeKey,
    stream: s ? { create: s } : undefined,
  };
}
