/**
 * Recherche de lieux de départ avec Photon (géocodeur OpenStreetMap de komoot, gratuit, sans clé). Côté serveur uniquement.
 * Null au moindre souci : l'interface propose alors de toucher la carte.
 */
const URL = "https://photon.komoot.io";
const TIMEOUT_MS = 4000;
const LIMIT = 6;

/** Lieu affiché dans la liste : « Forêt de Brocéliande » · « Paimpont, Ille-et-Vilaine ». */
export type Place = { id: string; name: string; detail: string; lat: number; lng: number };

export type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string; osm_id?: number; name?: string; street?: string; housenumber?: string;
    city?: string; district?: string; county?: string; country?: string; countrycode?: string;
  };
};

/** Conversion pure (tests : tools/test-routes.ts). Écarte les résultats sans nom ni rue, et les doublons. */
export function parsePhoton(features: PhotonFeature[]): Place[] {
  const out: Place[] = [], seen = new Set<string>();
  for (const f of features) {
    const p = f.properties, [lng, lat] = f.geometry.coordinates;
    const street = p.street ? [p.housenumber, p.street].filter(Boolean).join(" ") : null;
    const name = p.name ?? street;
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const detail = [p.name && street, p.city ?? p.district, p.county, p.countrycode !== "FR" && p.country].filter((x) => x && x !== name).join(", ");
    const key = `${name}|${detail}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: p.osm_type && p.osm_id ? `${p.osm_type}${p.osm_id}` : `${lat},${lng}`, name, detail, lat, lng });
  }
  return out;
}

async function photon(path: string, q: URLSearchParams): Promise<PhotonFeature[] | null> {
  try {
    const r = await fetch(`${URL}${path}?${q}`, {
      headers: { "User-Agent": "Pulse/1.0 (appli perso d'entraînement)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 86_400 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.features) ? j.features : null;
  } catch {
    return null;
  }
}

/** Lieux correspondant à `q`, les plus proches de `near` d'abord (domicile ou position). */
export async function searchPlaces(q: string, near?: { lat: number; lng: number }) {
  const params = new URLSearchParams({ q, lang: "fr", limit: String(LIMIT) });
  if (near) { params.set("lat", String(near.lat)); params.set("lon", String(near.lng)); }
  const f = await photon("/api/", params);
  return f && parsePhoton(f);
}

/** Nom du lieu le plus proche d'un point touché sur la carte. */
export async function placeAt(lat: number, lng: number) {
  const f = await photon("/reverse", new URLSearchParams({ lat: String(lat), lon: String(lng), lang: "fr", limit: "1" }));
  return f ? parsePhoton(f)[0] ?? null : null;
}
