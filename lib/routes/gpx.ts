/** Export GPX 1.1 d'une boucle : la trace avec l'altitude, les points d'intérêt en waypoints (OsmAnd, Garmin Connect). */
import { poiTitle, type RoutePoi } from "./poi";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const c6 = (x: number) => x.toFixed(6);

export function toGpx({ name, points, elevation, pois, time = new Date() }: {
  name: string;
  points: [number, number][];
  elevation?: number[];
  pois?: RoutePoi[];
  time?: Date;
}) {
  const wpt = (pois ?? []).map((p) =>
    `  <wpt lat="${c6(p.lat)}" lon="${c6(p.lng)}">\n    <name>${esc(p.name ?? poiTitle(p.type))}</name>\n    <desc>${esc(`${poiTitle(p.type)} · km ${p.km.toLocaleString("fr-FR")}`)}</desc>\n    <type>${esc(p.type)}</type>\n  </wpt>`);
  const trkpt = points.map(([lat, lng], i) => {
    const e = elevation?.[i];
    return e == null ? `      <trkpt lat="${c6(lat)}" lon="${c6(lng)}"/>` : `      <trkpt lat="${c6(lat)}" lon="${c6(lng)}"><ele>${Math.round(e)}</ele></trkpt>`;
  });
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Pulse" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">`,
    `  <metadata>\n    <name>${esc(name)}</name>\n    <time>${time.toISOString()}</time>\n  </metadata>`,
    ...wpt,
    `  <trk>\n    <name>${esc(name)}</name>\n    <trkseg>`,
    ...trkpt,
    `    </trkseg>\n  </trk>`,
    `</gpx>`,
    "",
  ].join("\n");
}

/** Nom de fichier sûr : « pulse-la-nature-12-4-km.gpx » */
export const gpxFileName = (label: string, km: number) =>
  `pulse-${label}-${km.toFixed(1)}-km`.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".gpx";
