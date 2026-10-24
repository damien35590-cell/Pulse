import { useSyncExternalStore } from "react";
import type { TileLayer, TileErrorEvent } from "leaflet";

/**
 * Fond de carte partagé (Stadia Maps, raster, endpoint UE) : sombre ou clair selon le thème de l'app.
 * Authentification par domaine (tableau de bord Stadia) : aucune clé dans le code, et les tuiles doivent partir avec leur
 * Referer / Origin (pas de referrerPolicy="no-referrer" sur les <img> ni sur Leaflet).
 * Aucune dépendance à Leaflet à l'exécution : la vignette statique du fil (route-preview) s'en sert aussi.
 */
export type MapTheme = "dark" | "light";

/** Un fond : id de style Stadia + filtre CSS optionnel appliqué aux tuiles seules (jamais au tracé). */
export type BasemapStyle = { style: string; filter?: string };

/** CHOIX DU FOND DE CARTE : changer de fond = modifier cette constante (un style, un filtre éventuel, par thème). */
export const BASEMAP: Record<MapTheme, BasemapStyle> = {
  dark: { style: "alidade_smooth_dark" },
  light: { style: "alidade_smooth" },
};

export const styleUrl = (style: string) => `https://tiles-eu.stadiamaps.com/tiles/${style}/{z}/{x}/{y}{r}.png`;

export const BASEMAP_URL: Record<MapTheme, string> = { dark: styleUrl(BASEMAP.dark.style), light: styleUrl(BASEMAP.light.style) };

/** Variantes comparées dans /ui-kit (temporaire). Stadia n'a pas de version sombre de bright ni d'outdoors : alidade_smooth_dark les remplace. */
export const BASEMAP_VARIANTS: { id: string; label: string; basemap: Record<MapTheme, BasemapStyle> }[] = [
  { id: "a", label: "a) alidade_smooth (actuel)", basemap: { light: { style: "alidade_smooth" }, dark: { style: "alidade_smooth_dark" } } },
  {
    id: "b",
    label: "b) alidade_smooth + filtre tuiles contrast(1.08) saturate(1.4)",
    basemap: { light: { style: "alidade_smooth", filter: "contrast(1.08) saturate(1.4)" }, dark: { style: "alidade_smooth_dark", filter: "contrast(1.08) saturate(1.4)" } },
  },
  { id: "c", label: "c) alidade_bright (sombre : pas de version, alidade_smooth_dark)", basemap: { light: { style: "alidade_bright" }, dark: { style: "alidade_smooth_dark" } } },
  { id: "d", label: "d) outdoors (sombre : pas de version, alidade_smooth_dark)", basemap: { light: { style: "outdoors" }, dark: { style: "alidade_smooth_dark" } } },
];
export const BASEMAP_MAX_ZOOM = 20;
export const BASEMAP_ATTRIBUTION = '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/** Version texte (vignette statique, sans lien : la carte entière mène au détail). */
export const BASEMAP_CREDIT = "© Stadia Maps © OpenMapTiles © OpenStreetMap";

/** Options communes de L.tileLayer ({r} = « @2x » sur écran haute densité, géré par Leaflet). */
export const basemapOptions = { maxZoom: BASEMAP_MAX_ZOOM, attribution: BASEMAP_ATTRIBUTION } as const;

/** Tuile en erreur : on la masque pour laisser voir le fond surface-2 du conteneur (le tracé reste visible), pas d'image cassée. */
export function hideBrokenTiles(layer: TileLayer) {
  layer.on("tileerror", (e: TileErrorEvent) => { e.tile.style.visibility = "hidden"; });
  // Filtre du fond sur le conteneur de tuiles seulement (le tracé est dans un autre pane).
  layer.on("add", () => applyTileFilter(layer, getMapTheme()));
  return layer;
}

function applyTileFilter(layer: TileLayer, theme: MapTheme) {
  const el = layer.getContainer();
  if (el) el.style.filter = BASEMAP[theme].filter ?? "";
}

/** Change de thème sur un fond Leaflet existant : URL et filtre. */
export function setBasemap(layer: TileLayer | null, theme: MapTheme) {
  if (!layer) return;
  layer.setUrl(BASEMAP_URL[theme]);
  applyTileFilter(layer, theme);
}

/** URL d'une tuile précise (vignette statique), pour le fond courant ou un style donné. */
export function tileUrl(theme: MapTheme, z: number, x: number, y: number, retina = false, style = BASEMAP[theme].style) {
  return styleUrl(style).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)).replace("{r}", retina ? "@2x" : "");
}

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Thème affiché : <html data-theme> s'il est forcé, sinon le réglage du téléphone ; sombre par défaut. */
export function getMapTheme(): MapTheme {
  if (typeof document === "undefined") return "dark";
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return typeof matchMedia !== "undefined" && !matchMedia(DARK_QUERY).matches && matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia(DARK_QUERY);
  mq.addEventListener("change", cb);
  return () => { obs.disconnect(); mq.removeEventListener("change", cb); };
}

/** Thème courant, mis à jour quand l'utilisateur change de thème (réglages) ou que le système bascule. */
export function useMapTheme(): MapTheme {
  return useSyncExternalStore(subscribe, getMapTheme, () => "dark");
}
