export type ActivityKind = "RUN" | "RIDE" | "SWIM" | "HIKE" | "WALK" | "WORKOUT" | "OTHER";

export type TrackPoint = { lat?: number; lng?: number; ele?: number; t: number; hr?: number };

export type ParsedActivity = {
  /** Clé anti-doublon : début de l'activité arrondi à la minute (UTC). */
  dedupeKey: string;
  source: "fit" | "gpx";
  fileName: string;
  type: ActivityKind;
  title: string;
  startedAt: string; // ISO
  distanceM: number;
  movingTimeS: number;
  elapsedTimeS: number;
  elevationGainM: number;
  avgHr?: number;
  maxHr?: number;
  calories?: number;
  startLat?: number;
  startLng?: number;
  points: TrackPoint[];
};
