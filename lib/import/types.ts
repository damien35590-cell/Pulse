export type ActivityKind = "RUN" | "RIDE" | "EBIKE" | "SWIM" | "HIKE" | "WALK" | "WORKOUT" | "OTHER";

import type { StreamData } from "../stream";

export type TrackPoint = { lat?: number; lng?: number; ele?: number; t: number; hr?: number; power?: number; cad?: number };

export type ParsedActivity = {
  /** Clé anti-doublon : début de l'activité arrondi à la minute (UTC). */
  dedupeKey: string;
  /** Identifiant dans la source d'origine (id d'activité Strava) ; à défaut, la clé anti-doublon. */
  externalId?: string;
  source: "fit" | "gpx" | "strava";
  fileName: string;
  type: ActivityKind;
  title: string;
  /** Description / commentaire de la source (Strava), enregistré dans les notes. */
  notes?: string;
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
  /** Type de séance d'après Strava : "race" (Compétition) ou "long" (Sortie longue) ; absent = détection automatique. */
  sessionType?: "race" | "long";
  points: TrackPoint[];
};
