/** Points d'intérêt OpenStreetMap : classement par type, libellés au singulier et au pluriel. Partagé client / serveur. */

export type PoiType =
  | "viewpoint" | "attraction" | "artwork" | "picnic_site"
  | "peak" | "spring" | "waterfall" | "cave_entrance"
  | "castle" | "ruins" | "cross" | "memorial" | "monument" | "manor" | "church" | "archaeological_site" | "historic"
  | "lighthouse" | "tower" | "windmill" | "drinking_water"
  /** Cimetière : robinet presque toujours présent, signalé seulement pour une sortie longue (lib/routes/session-fit.ts). */
  | "cemetery";

/** Point d'intérêt sur une boucle : km = position le long du tracé. */
export type RoutePoi = { id: string; name: string | null; type: PoiType; lat: number; lng: number; km: number };

export const POI_LABELS: Record<PoiType, { one: string; many: string }> = {
  viewpoint: { one: "point de vue", many: "points de vue" },
  attraction: { one: "curiosité", many: "curiosités" },
  artwork: { one: "œuvre d'art", many: "œuvres d'art" },
  picnic_site: { one: "aire de pique-nique", many: "aires de pique-nique" },
  peak: { one: "sommet", many: "sommets" },
  spring: { one: "source", many: "sources" },
  waterfall: { one: "cascade", many: "cascades" },
  cave_entrance: { one: "grotte", many: "grottes" },
  castle: { one: "château", many: "châteaux" },
  ruins: { one: "ruine", many: "ruines" },
  cross: { one: "calvaire", many: "calvaires" },
  memorial: { one: "mémorial", many: "mémoriaux" },
  monument: { one: "monument", many: "monuments" },
  manor: { one: "manoir", many: "manoirs" },
  church: { one: "chapelle ou église", many: "chapelles ou églises" },
  archaeological_site: { one: "site archéologique", many: "sites archéologiques" },
  historic: { one: "lieu historique", many: "lieux historiques" },
  lighthouse: { one: "phare", many: "phares" },
  tower: { one: "tour", many: "tours" },
  windmill: { one: "moulin", many: "moulins" },
  drinking_water: { one: "point d'eau", many: "points d'eau" },
  cemetery: { one: "cimetière", many: "cimetières" },
};

/** Pas des curiosités : eau potable et cimetières (robinet probable), comptés à part. */
export const isWaterPoi = (t: PoiType) => t === "drinking_water" || t === "cemetery";

export const poiLabel = (t: PoiType, n = 1) => (n > 1 ? POI_LABELS[t].many : POI_LABELS[t].one);
/** « Point de vue » : libellé capitalisé pour une liste. */
export const poiTitle = (t: PoiType) => POI_LABELS[t].one.charAt(0).toUpperCase() + POI_LABELS[t].one.slice(1);

// historic=* trop fréquents pour être des curiosités (tombes d'un cimetière, bornes).
const HISTORIC_SKIP = new Set(["tomb", "tombstone", "grave", "boundary_stone", "district_boundary"]);
const HISTORIC: Record<string, PoiType> = {
  castle: "castle", fort: "castle", ruins: "ruins", wayside_cross: "cross", wayside_shrine: "cross", memorial: "memorial",
  monument: "monument", manor: "manor", church: "church", chapel: "church", archaeological_site: "archaeological_site",
};

/** Type d'un élément OSM d'après ses tags, ou null s'il ne compte pas. */
export function classifyPoi(tags: Record<string, string>): PoiType | null {
  const t = tags.tourism, n = tags.natural, h = tags.historic, m = tags.man_made;
  if (tags.amenity === "drinking_water") return "drinking_water";
  // Fontaine, point d'eau ou robinet explicitement potables.
  if ((tags.amenity === "fountain" || tags.amenity === "water_point" || tags.man_made === "water_tap") && tags.drinking_water === "yes") return "drinking_water";
  if (tags.landuse === "cemetery" || tags.amenity === "grave_yard") return "cemetery";
  if (t === "viewpoint" || t === "attraction" || t === "artwork" || t === "picnic_site") return t;
  if (n === "peak" || n === "spring" || n === "waterfall" || n === "cave_entrance") return n;
  if (m === "lighthouse" || m === "windmill") return m;
  if (m === "tower") return tags["tower:type"] === "communication" ? null : "tower"; // les antennes ne sont pas des curiosités
  if (h) return HISTORIC_SKIP.has(h) ? null : HISTORIC[h] ?? (h === "mill" || h === "windmill" ? "windmill" : "historic");
  return null;
}
