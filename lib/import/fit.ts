import FitParser from "fit-file-parser";
import { dedupeKeyOf } from "./stats";
import type { ActivityKind, ParsedActivity, TrackPoint } from "./types";

const SPORTS: Record<string, ActivityKind> = {
  running: "RUN", cycling: "RIDE", swimming: "SWIM", hiking: "HIKE",
  walking: "WALK", training: "WORKOUT", e_biking: "RIDE", virtual_activity: "RIDE",
};
const TITLES: Record<ActivityKind, string> = {
  RUN: "Course", RIDE: "Sortie vélo", SWIM: "Natation", HIKE: "Randonnée",
  WALK: "Marche", WORKOUT: "Séance", OTHER: "Activité importée",
};

export function parseFit(buf: ArrayBuffer, fileName: string): Promise<ParsedActivity> {
  const parser = new FitParser({ force: true, speedUnit: "m/s", lengthUnit: "m", mode: "list" });
  return new Promise((resolve, reject) => {
    parser.parse(buf, (err: unknown, data: any) => {
      if (err) return reject(new Error("Fichier FIT illisible"));
      const s = data?.sessions?.[0];
      if (!s) return reject(new Error("FIT sans session"));

      const points: TrackPoint[] = (data.records ?? [])
        .filter((r: any) => r.timestamp)
        .map((r: any) => ({
          lat: r.position_lat, lng: r.position_long,
          ele: r.enhanced_altitude ?? r.altitude,
          t: new Date(r.timestamp).getTime(), hr: r.heart_rate,
        }));

      const startedAt = new Date(s.start_time ?? points[0]?.t).toISOString();
      const type = SPORTS[String(s.sub_sport === "virtual_activity" ? "virtual_activity" : s.sport)] ?? "OTHER";
      const first = points.find((p) => p.lat != null);

      resolve({
        dedupeKey: dedupeKeyOf(startedAt),
        source: "fit",
        fileName,
        type,
        title: TITLES[type],
        startedAt,
        distanceM: s.total_distance ?? 0,
        movingTimeS: Math.round(s.total_timer_time ?? 0),
        elapsedTimeS: Math.round(s.total_elapsed_time ?? s.total_timer_time ?? 0),
        elevationGainM: s.total_ascent ?? 0,
        avgHr: s.avg_heart_rate, maxHr: s.max_heart_rate, calories: s.total_calories,
        startLat: first?.lat, startLng: first?.lng,
        points,
      });
    });
  });
}
