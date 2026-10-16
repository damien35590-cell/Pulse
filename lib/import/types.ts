export type ActivityKind = "RUN" | "RIDE" | "EBIKE" | "SWIM" | "HIKE" | "WALK" | "WORKOUT" | "OTHER";

import type { StreamData } from "../stream";

export type TrackPoint = { lat?: number; lng?: number; ele?: number; t: number; hr?: number; power?: number; cad?: number };

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
  avgPower?: number;
  stream?: StreamData; // série à 1 Hz (calculée dans le navigateur ou sur le serveur)
  maxPower?: number;
  calories?: number;
  startLat?: number;
  startLng?: number;
  points: TrackPoint[];
};
