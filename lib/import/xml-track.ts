import * as cheerio from "cheerio";
import { trackActivity } from "./gpx";
import type { ParsedActivity, TrackPoint } from "./types";

/**
 * GPX et TCX côté Node (scripts, serveur) : parseGpx s'appuie sur DOMParser, absent de Node.
 * Seule la lecture du XML est ici (cheerio) ; distance, dénivelé, moyennes et type viennent de trackActivity (lib/import/gpx.ts).
 */
const num = (s: string | undefined) => { const v = s == null || s.trim() === "" ? NaN : Number(s); return Number.isFinite(v) ? v : undefined; };

/** Premier descendant dont le nom local (sans préfixe d'espace de noms) est `name`. */
function local($: cheerio.CheerioAPI, el: cheerio.Cheerio<any>, name: string) {
  const found = el.find("*").filter((_, n) => (n as { name?: string }).name?.split(":").pop()?.toLowerCase() === name).first();
  return found.length ? found.text().trim() : undefined;
}

function gpxPoints($: cheerio.CheerioAPI): TrackPoint[] {
  const out: TrackPoint[] = [];
  $("trkpt").each((_, node) => {
    const el = $(node), time = el.children("time").text().trim();
    if (!time) return;
    out.push({
      lat: num(el.attr("lat")), lng: num(el.attr("lon")), ele: num(el.children("ele").text()), t: Date.parse(time),
      hr: num(local($, el, "hr")), cad: num(local($, el, "cad")), power: num(local($, el, "power") ?? local($, el, "watts")),
    });
  });
  return out;
}

function tcxPoints($: cheerio.CheerioAPI): TrackPoint[] {
  const out: TrackPoint[] = [];
  $("Trackpoint").each((_, node) => {
    const el = $(node), time = el.children("Time").text().trim();
    if (!time) return;
    out.push({
      lat: num(el.find("LatitudeDegrees").text()), lng: num(el.find("LongitudeDegrees").text()), ele: num(el.children("AltitudeMeters").text()), t: Date.parse(time),
      hr: num(el.children("HeartRateBpm").children("Value").text()), cad: num(el.children("Cadence").text() || local($, el, "runcadence")), power: num(local($, el, "watts")),
    });
  });
  return out;
}

export function parseXmlTrack(text: string, fileName: string, kind: "gpx" | "tcx"): ParsedActivity {
  const $ = cheerio.load(text, { xmlMode: true });
  if (kind === "gpx") {
    if (!$("gpx").length) throw new Error("GPX illisible");
    const name = $("trk > name").first().text().trim() || undefined;
    return trackActivity(gpxPoints($), { name, type: $("trk > type").first().text() || name || "", fileName });
  }
  if (!$("TrainingCenterDatabase").length) throw new Error("TCX illisible");
  const name = $("Activity > Notes").first().text().trim() || undefined;
  return trackActivity(tcxPoints($), { name, type: $("Activity").first().attr("Sport") ?? "", fileName });
}
