/**
 * Fiche d'un point d'intérêt : tags OpenStreetMap utiles (Overpass) et résumé Wikipédia quand il existe.
 * Côté serveur, gratuit et sans clé ; mis en cache une semaine. Conversion des tags pure (tests : tools/test-habits.ts).
 */
const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = { "User-Agent": "Pulse/1.0 (appli perso d'entraînement)" };
const TIMEOUT_MS = 8000;
const WEEK_S = 7 * 86_400;

export type PoiFact = { label: string; value: string };
export type PoiDetails = {
  osmUrl: string;
  name: string | null;
  facts: PoiFact[];
  description: string | null;
  website: string | null;
  wiki: { title: string; extract: string; image: string | null; url: string } | null;
};

/** « n123 » → { type: "node", id: 123 } (identifiants de lib/routes/overpass.ts). */
export function parsePoiId(id: string) {
  const m = /^([nwr])(\d{1,12})$/.exec(id);
  if (!m) return null;
  return { type: ({ n: "node", w: "way", r: "relation" } as const)[m[1] as "n" | "w" | "r"], id: Number(m[2]) };
}

const HERITAGE: Record<string, string> = { "1": "Patrimoine mondial", "2": "Monument historique", "3": "Monument historique" };
const DRINKABLE: Record<string, string> = { yes: "Eau potable", no: "Eau non potable", treated: "Eau traitée" };

/** Tags OSM → faits lisibles (altitude, époque, artiste, horaires…), dans un ordre fixe. */
export function poiFacts(tags: Record<string, string>): PoiFact[] {
  const out: PoiFact[] = [];
  const add = (label: string, v?: string | null) => { if (v && v.trim()) out.push({ label, value: v.trim() }); };
  if (tags.ele && /^-?\d+(\.\d+)?$/.test(tags.ele)) add("Altitude", `${Math.round(Number(tags.ele))} m`);
  add("Époque", tags.start_date && /^(~|C)?\d{1,4}/.test(tags.start_date) ? tags.start_date.replace(/^~/, "vers ").replace(/^C(\d+)$/, "$1ᵉ siècle") : null);
  add("Artiste", tags.artist_name ?? tags.artist);
  add("Patrimoine", tags.heritage ? HERITAGE[tags.heritage] ?? "Patrimoine protégé" : null);
  add("Eau", tags.drinking_water ? DRINKABLE[tags.drinking_water] ?? null : tags.amenity === "drinking_water" ? "Eau potable" : null);
  add("Horaires", tags.opening_hours ? tags.opening_hours.replace(/Mo/g, "lun").replace(/Tu/g, "mar").replace(/We/g, "mer").replace(/Th/g, "jeu").replace(/Fr/g, "ven").replace(/Sa/g, "sam").replace(/Su/g, "dim").replace(/off/g, "fermé") : null);
  add("Accès", tags.fee === "yes" ? "Payant" : tags.fee === "no" ? "Gratuit" : null);
  add("Gestion", tags.operator);
  add("Inscription", tags.inscription && tags.inscription.length <= 160 ? tags.inscription : null);
  return out;
}

async function json(url: string, init?: RequestInit) {
  try {
    const r = await fetch(url, { ...init, headers: { ...UA, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: WEEK_S } } as RequestInit);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Titre Wikipédia français : tag wikipedia=fr:…, sinon via Wikidata. */
async function frTitle(tags: Record<string, string>) {
  const w = tags.wikipedia ?? tags["wikipedia:fr"];
  if (w) { const m = /^(?:(\w{2,3}):)?(.+)$/.exec(w); if (m && (!m[1] || m[1] === "fr")) return m[2]; }
  const q = tags.wikidata;
  if (!q || !/^Q\d+$/.test(q)) return null;
  const j = await json(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${q}&props=sitelinks&sitefilter=frwiki&format=json`);
  return (j?.entities?.[q]?.sitelinks?.frwiki?.title as string | undefined) ?? null;
}

async function wikiSummary(title: string): Promise<PoiDetails["wiki"]> {
  const j = await json(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`);
  if (!j?.extract || j.type === "disambiguation") return null;
  return { title: j.title ?? title, extract: String(j.extract), image: j.thumbnail?.source ?? null, url: j.content_urls?.mobile?.page ?? `https://fr.wikipedia.org/wiki/${encodeURIComponent(title)}` };
}

export async function getPoiDetails(id: string): Promise<PoiDetails | null> {
  const ref = parsePoiId(id);
  if (!ref) return null;
  const osmUrl = `https://www.openstreetmap.org/${ref.type}/${ref.id}`;
  const q = `[out:json][timeout:10];${ref.type}(${ref.id});out tags;`;
  // En GET : la réponse peut être mise en cache par Next (une semaine).
  const j = await json(`${OVERPASS}?data=${encodeURIComponent(q)}`);
  const tags = (j?.elements?.[0]?.tags as Record<string, string> | undefined) ?? null;
  if (!tags) return { osmUrl, name: null, facts: [], description: null, website: null, wiki: null };
  const title = await frTitle(tags);
  const website = tags.website ?? tags["contact:website"] ?? null;
  return {
    osmUrl,
    name: tags["name:fr"] ?? tags.name ?? null,
    facts: poiFacts(tags),
    description: tags["description:fr"] ?? tags.description ?? null,
    website: website && /^https?:\/\//.test(website) ? website : null,
    wiki: title ? await wikiSummary(title) : null,
  };
}
