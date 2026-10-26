import { gunzipSync, unzipSync } from "fflate";
import { parseFit } from "./fit";
import { parseGpx, parseTcx } from "./gpx";
import type { ParsedActivity } from "./types";

const ACTIVITY_FILE = /\.(fit|gpx|tcx)(\.gz)?$/i;

export async function parseOne(name: string, bytes: Uint8Array): Promise<ParsedActivity> {
  let data = bytes;
  let n = name.toLowerCase();
  if (n.endsWith(".gz")) { data = gunzipSync(bytes); n = n.slice(0, -3); } // archive Strava : *.fit.gz
  if (n.endsWith(".fit")) return parseFit(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, name);
  if (n.endsWith(".gpx")) return parseGpx(new TextDecoder().decode(data), name);
  if (n.endsWith(".tcx")) return parseTcx(new TextDecoder().decode(data), name);
  throw new Error("Format non pris en charge");
}

/** Accepte .fit, .gpx, .tcx, .fit.gz et l'archive ZIP Strava ; dédoublonne par minute de départ. */
export async function importFiles(files: File[]) {
  const found = new Map<string, ParsedActivity>();
  const errors: string[] = [];
  const queue: { name: string; bytes: Uint8Array }[] = [];

  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (/\.zip$/i.test(f.name)) {
      const entries = unzipSync(bytes, { filter: (e) => ACTIVITY_FILE.test(e.name) });
      for (const [name, b] of Object.entries(entries)) queue.push({ name, bytes: b });
    } else queue.push({ name: f.name, bytes });
  }

  for (const { name, bytes } of queue) {
    try {
      const a = await parseOne(name, bytes);
      if (!found.has(a.dedupeKey)) found.set(a.dedupeKey, a);
    } catch (e) {
      errors.push(`${name} : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }
  const activities = [...found.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return { activities, errors };
}
