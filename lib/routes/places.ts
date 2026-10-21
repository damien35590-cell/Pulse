/**
 * Recherche de lieux de départ, côté serveur uniquement, gratuite et sans clé :
 * - IGN Géoplateforme (BAN + lieux nommés BD TOPO) : connaît les hameaux et lieux-dits, autocomplétion tolérante aux fautes ;
 * - Photon (OpenStreetMap, komoot) : parkings, forêts, étangs saisis dans OSM ;
 * - Annuaire des entreprises (SIRENE, recherche-entreprises.api.gouv.fr) : une entreprise par son nom, établissements ouverts géolocalisés.
 * Les trois sont interrogées en parallèle puis fusionnées. Null si aucune ne répond : l'interface propose alors la carte.
 */
const URL = "https://photon.komoot.io";
const IGN = "https://data.geopf.fr/geocodage";
const SIRENE = "https://recherche-entreprises.api.gouv.fr/search";
const TIMEOUT_MS = 4000;
const LIMIT = 6;

/** Lieu affiché dans la liste : « Forêt de Brocéliande » · « Paimpont, Ille-et-Vilaine ». */
export type Place = { id: string; name: string; detail: string; lat: number; lng: number; km?: number };

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

export type IgnCompletion = { x: number; y: number; city?: string; zipcode?: string; kind?: string; fulltext?: string };

/** Département affiché après la commune : « Paimpont (35) ». */
const dept = (zip?: string) => (zip && /^\d{5}$/.test(zip) ? (zip.startsWith("97") ? zip.slice(0, 3) : zip.slice(0, 2)) : "");

/** Conversion pure de l'autocomplétion IGN (« Girec, 31160 Boutx » → Girec · Boutx (31)). */
export function parseIgnCompletion(results: IgnCompletion[]): Place[] {
  const out: Place[] = [];
  for (const r of results) {
    const [lng, lat] = [Number(r.x), Number(r.y)];
    const name = r.fulltext?.split(",")[0]?.trim();
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const d = dept(r.zipcode), city = r.city && r.city !== name ? r.city : "";
    const detail = [city, d && `(${d})`].filter(Boolean).join(" ") || (d ? `Département ${d}` : "");
    out.push({ id: `ign:${lat.toFixed(5)},${lng.toFixed(5)}`, name, detail, lat, lng });
  }
  return out;
}

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v) as string | undefined;

/** Conversion pure d'une réponse /search IGN (index poi ou address). */
export function parseIgnSearch(features: { geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> }[]): Place[] {
  const out: Place[] = [];
  for (const f of features) {
    const [lng, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    const name = first(p.toponym) ?? first(p.name) ?? first(p.label);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const city = first(p.city), d = dept(first(p.postcode));
    const detail = [city && city !== name ? city : "", d && `(${d})`].filter(Boolean).join(" ");
    out.push({ id: `ign:${lat.toFixed(5)},${lng.toFixed(5)}`, name, detail, lat, lng });
  }
  return out;
}

async function getJson(url: string): Promise<unknown | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Pulse/1.0 (appli perso d'entraînement)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 86_400 },
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function ign(q: string, near?: { lat: number; lng: number }): Promise<Place[] | null> {
  const c = new URLSearchParams({ text: q, maximumResponses: "8" });
  if (near) c.set("lonlat", `${near.lng},${near.lat}`);
  const s = new URLSearchParams({ q, index: "poi", limit: "6" });
  if (near) { s.set("lat", String(near.lat)); s.set("lon", String(near.lng)); }
  const [comp, poi] = (await Promise.all([getJson(`${IGN}/completion/?${c}`), getJson(`${IGN}/search?${s}`)])) as [
    { results?: IgnCompletion[] } | null, { features?: Parameters<typeof parseIgnSearch>[0] } | null,
  ];
  if (!comp && !poi) return null;
  return [...parseIgnSearch(poi?.features ?? []), ...parseIgnCompletion(comp?.results ?? [])];
}

export type Etablissement = {
  adresse?: string; latitude?: string | number | null; longitude?: string | number | null; libelle_commune?: string; code_postal?: string;
  etat_administratif?: string; statut_diffusion_etablissement?: string; nom_commercial?: string | null; liste_enseignes?: string[] | null; siret?: string;
};
export type Entreprise = { nom_complet?: string; siege?: Etablissement; matching_etablissements?: Etablissement[] };

const cap = (s: string) => s.toLowerCase().replace(/(^|[\s'-])\p{L}/gu, (m) => m.toUpperCase());

/**
 * Conversion pure de l'annuaire des entreprises : établissements ouverts, diffusibles et géolocalisés.
 * « GEIREC » · « 276 Rue De Chateaugiron, Rennes (35) ». Boîtes postales (CS, BP) retirées de l'adresse.
 */
export function parseEntreprises(results: Entreprise[]): Place[] {
  const out: Place[] = [];
  for (const e of results) {
    const list = e.matching_etablissements?.length ? e.matching_etablissements : e.siege ? [e.siege] : [];
    for (const et of list) {
      const lat = Number(et.latitude), lng = Number(et.longitude);
      if (et.etat_administratif !== "A" || et.statut_diffusion_etablissement === "N" || !et.latitude || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const name = cap(et.liste_enseignes?.[0] ?? et.nom_commercial ?? e.nom_complet ?? "").trim();
      if (!name) continue;
      const street = (et.adresse ?? "").replace(/\b(CS|BP|TSA)\s*\d+\b/gi, "").replace(/\b\d{5}\b.*$/, "").replace(/\s+/g, " ").trim();
      const d = dept(et.code_postal), city = et.libelle_commune ? cap(et.libelle_commune) : "";
      const detail = [street && cap(street), [city, d && `(${d})`].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      out.push({ id: `siret:${et.siret ?? `${lat},${lng}`}`, name, detail, lat, lng });
    }
  }
  return out;
}

async function entreprises(q: string): Promise<Place[] | null> {
  const j = (await getJson(`${SIRENE}?${new URLSearchParams({ q, per_page: "5", etat_administratif: "A" })}`)) as { results?: Entreprise[] } | null;
  return j ? parseEntreprises(j.results ?? []) : null;
}

/** Distance en km (haversine). */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Fusion pure (tests : tools/test-routes.ts) : doublons à moins de 150 m écartés (la 1re source gagne),
 * puis tri : nom qui commence par la saisie, puis qui la contient, puis le reste ; à égalité, le plus proche.
 */
export function mergePlaces(lists: Place[][], q: string, near?: { lat: number; lng: number }, limit = 8): Place[] {
  const all: Place[] = [];
  for (const p of lists.flat()) if (!all.some((x) => km(x, p) < 0.15)) all.push(near ? { ...p, km: Math.round(km(near, p) * 10) / 10 } : p);
  const nq = norm(q), rank = (p: Place) => { const n = norm(p.name); return n.startsWith(nq) ? 0 : n.includes(nq) ? 1 : 2; };
  return all.sort((a, b) => rank(a) - rank(b) || (a.km ?? 0) - (b.km ?? 0)).slice(0, limit);
}

/** Lieux correspondant à `q` (IGN + Photon + entreprises), les plus proches de `near` d'abord (domicile ou position). */
export async function searchPlaces(q: string, near?: { lat: number; lng: number }) {
  const params = new URLSearchParams({ q, lang: "fr", limit: String(LIMIT) });
  if (near) { params.set("lat", String(near.lat)); params.set("lon", String(near.lng)); }
  const [fromIgn, f, firms] = await Promise.all([ign(q, near), photon("/api/", params), entreprises(q)]);
  if (!fromIgn && !f && !firms) return null;
  return mergePlaces([fromIgn ?? [], f ? parsePhoton(f) : [], firms ?? []], q, near);
}

/** Nom du lieu le plus proche d'un point touché sur la carte. */
export async function placeAt(lat: number, lng: number) {
  const f = await photon("/reverse", new URLSearchParams({ lat: String(lat), lon: String(lng), lang: "fr", limit: "1" }));
  const osm = f ? parsePhoton(f)[0] : undefined;
  if (osm) return osm;
  // Repli IGN : lieu-dit ou adresse le plus proche.
  const j = (await getJson(`${IGN}/reverse?${new URLSearchParams({ lat: String(lat), lon: String(lng), index: "poi,address", limit: "1" })}`)) as { features?: Parameters<typeof parseIgnSearch>[0] } | null;
  return j ? parseIgnSearch(j.features ?? [])[0] ?? null : null;
}
