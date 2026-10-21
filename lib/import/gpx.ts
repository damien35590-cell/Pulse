import { dedupeKeyOf, elevationGain, totalDistance } from "./stats";
import type { ActivityKind, ParsedActivity, TrackPoint } from "./types";

const kindOf = (t: string): ActivityKind => {
  const s = t.toLowerCase();
  if (/run|course|9\b/.test(s)) return "RUN";
  if (/e-?bik|e_bik|vae|[ée]lectrique/.test(s)) return "EBIKE";
  if (/bik|cycl|ride|velo|vélo|1\b/.test(s)) return "RIDE";
  if (/swim|nat/.test(s)) return "SWIM";
  if (/hik|rando/.test(s)) return "HIKE";
  if (/walk|marche/.test(s)) return "WALK";
  return "OTHER";
};

export function parseGpx(text: string, fileName: string): ParsedActivity {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("GPX illisible");

  const trk = doc.getElementsByTagName("trk")[0];
  const name = trk?.getElementsByTagName("name")[0]?.textContent?.trim();
  const type = trk?.getElementsByTagName("type")[0]?.textContent ?? name ?? "";

  const points: TrackPoint[] = [];
  for (const el of Array.from(doc.getElementsByTagName("trkpt"))) {
    const time = el.getElementsByTagName("time")[0]?.textContent;
    if (!time) continue;
    const ele = el.getElementsByTagName("ele")[0]?.textContent;
    // La FC est dans <gpxtpx:hr> (Garmin) : on cherche par nom local
    const hr = Array.from(el.getElementsByTagName("*")).find((n) => n.localName === "hr")?.textContent;
    points.push({
      lat: Number(el.getAttribute("lat")),
      lng: Number(el.getAttribute("lon")),
      ele: ele ? Number(ele) : undefined,
      t: Date.parse(time),
      hr: hr ? Number(hr) : undefined,
    });
  }
  return trackActivity(points, { name, type, fileName });
}

/** Activité à partir de points déjà lus (GPX ou TCX) : commun au navigateur (DOMParser) et à Node (lib/import/xml-track.ts). */
export function trackActivity(points: TrackPoint[], o: { name?: string; type: string; fileName: string }): ParsedActivity {
  if (points.length < 2) throw new Error("Aucun point GPS exploitable");

  const startedAt = new Date(points[0].t).toISOString();
  const elapsed = Math.round((points[points.length - 1].t - points[0].t) / 1000);
  const hrs = points.map((p) => p.hr).filter((h): h is number => h != null);
  const pws = points.map((p) => p.power).filter((w): w is number => w != null && w > 0);

  return {
    dedupeKey: dedupeKeyOf(startedAt),
    source: "gpx",
    fileName: o.fileName,
    type: kindOf(o.type),
    title: o.name || "Activité importée",
    startedAt,
    distanceM: totalDistance(points),
    movingTimeS: elapsed, // GPX n'indique pas les pauses : on prend la durée totale
    elapsedTimeS: elapsed,
    elevationGainM: elevationGain(points),
    avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
    maxHr: hrs.length ? Math.max(...hrs) : undefined,
    avgPower: pws.length ? Math.round(pws.reduce((a, b) => a + b, 0) / pws.length) : undefined,
    maxPower: pws.length ? Math.max(...pws) : undefined,
    startLat: points[0].lat,
    startLng: points[0].lng,
    points,
  };
}
