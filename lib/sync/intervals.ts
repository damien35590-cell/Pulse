import { parseOne } from "@/lib/import";
import { saveActivities } from "@/lib/import/save";

const BASE = "https://intervals.icu/api/v1";
const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Va chercher sur Intervals.icu (API gratuite) les activités récentes qui ont un fichier original (FIT/GPX/TCX),
 * puis les enregistre dans Pulse. Les doublons sont ignorés. Une activité arrivée seulement via Strava n'a pas de fichier : elle est sautée.
 */
export async function syncIntervals(uid: string, days = 3) {
  const key = process.env.INTERVALS_API_KEY?.trim();
  if (!key) throw new Error("INTERVALS_API_KEY manquante dans Vercel");
  const headers = { Authorization: "Basic " + Buffer.from(`API_KEY:${key}`).toString("base64") };
  const now = new Date(), oldest = day(new Date(+now - days * 864e5)), newest = day(new Date(+now + 864e5));

  const r = await fetch(`${BASE}/athlete/0/activities?oldest=${oldest}&newest=${newest}`, { headers, signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) throw new Error("Clé Intervals.icu refusée");
  if (!r.ok) throw new Error(`Intervals.icu a répondu ${r.status}`);
  const list = (await r.json()) as { id: string; file_type?: string | null }[];

  const out = { found: list.length, withFile: 0, saved: 0, duplicates: 0, backfilled: 0, skipped: 0, errors: [] as string[] };
  for (const a of list) {
    if (!a.file_type) { out.skipped++; continue; }
    out.withFile++;
    try {
      const f = await fetch(`${BASE}/activity/${a.id}/file`, { headers, signal: AbortSignal.timeout(30000) });
      if (!f.ok) throw new Error(`fichier indisponible (${f.status})`);
      const bytes = new Uint8Array(await f.arrayBuffer());
      const gz = bytes[0] === 0x1f && bytes[1] === 0x8b; // le fichier peut arriver compressé ou déjà décompressé
      const act = await parseOne(`${a.id}.${a.file_type}${gz ? ".gz" : ""}`, bytes);
      const res = await saveActivities(uid, [act]);
      out.saved += res.saved; out.duplicates += res.duplicates; out.backfilled += res.backfilled;
    } catch (e) {
      out.errors.push(`${a.id} : ${e instanceof Error ? e.message : "erreur"}`);
    }
  }
  return out;
}
