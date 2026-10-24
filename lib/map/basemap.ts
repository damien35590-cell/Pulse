import { useSyncExternalStore } from "react";
import type { TileLayer, TileErrorEvent } from "leaflet";

/**
 * Fond de carte partagé (Stadia Maps, raster, endpoint UE) : sombre ou clair selon le thème de l'app.
 * Authentification par domaine (tableau de bord Stadia) : aucune clé dans le code, et les tuiles doivent partir avec leur
 * Referer / Origin (pas de referrerPolicy="no-referrer" sur les <img> ni sur Leaflet).
 * Aucune dépendance à Leaflet à l'exécution : la vignette statique du fil (route-preview) s'en sert aussi.
 */
export type MapTheme = "dark" | "light";

export const BASEMAP_URL: Record<MapTheme, string> = {
  dark: "https://tiles-eu.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  light: "https://tiles-eu.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png",
};
export const BASEMAP_MAX_ZOOM = 20;
export const BASEMAP_ATTRIBUTION = '© <a href="https://stadiamaps.com/">Stadia Maps</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/** Version texte (vignette statique, sans lien : la carte entière mène au détail). */
export const BASEMAP_CREDIT = "© Stadia Maps © OpenMapTiles © OpenStreetMap";

/** Options communes de L.tileLayer ({r} = « @2x » sur écran haute densité, géré par Leaflet). */
export const basemapOptions = { maxZoom: BASEMAP_MAX_ZOOM, attribution: BASEMAP_ATTRIBUTION } as const;

/** Tuile en erreur : on la masque pour laisser voir le fond surface-2 du conteneur (le tracé reste visible), pas d'image cassée. */
export function hideBrokenTiles(layer: TileLayer) {
  layer.on("tileerror", (e: TileErrorEvent) => { e.tile.style.visibility = "hidden"; });
  return layer;
}

/** URL d'une tuile précise (vignette statique). */
export function tileUrl(theme: MapTheme, z: number, x: number, y: number, retina = false) {
  return BASEMAP_URL[theme].replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)).replace("{r}", retina ? "@2x" : "");
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
