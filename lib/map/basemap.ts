import { useSyncExternalStore } from "react";

/**
 * Fond de carte partagé (CARTO, raster) : sombre ou clair selon le thème de l'app.
 * Aucune dépendance à Leaflet : la vignette statique du fil (route-preview) s'en sert aussi.
 */
export type MapTheme = "dark" | "light";

export const BASEMAP_URL: Record<MapTheme, string> = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
};
export const BASEMAP_SUBDOMAINS = "abcd";
export const BASEMAP_MAX_ZOOM = 20;
export const BASEMAP_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>';
/** Version texte (vignette statique, sans lien : la carte entière mène au détail). */
export const BASEMAP_CREDIT = "© OpenStreetMap contributors © CARTO";

/** Options communes de L.tileLayer ({r} = « @2x » sur écran haute densité, géré par Leaflet). */
export const basemapOptions = { subdomains: BASEMAP_SUBDOMAINS, maxZoom: BASEMAP_MAX_ZOOM, attribution: BASEMAP_ATTRIBUTION } as const;

/** URL d'une tuile précise (vignette statique). Sous-domaine stable par tuile : le cache du navigateur sert. */
export function tileUrl(theme: MapTheme, z: number, x: number, y: number, retina = false) {
  const s = BASEMAP_SUBDOMAINS[(x + y) % BASEMAP_SUBDOMAINS.length];
  return BASEMAP_URL[theme].replace("{s}", s).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)).replace("{r}", retina ? "@2x" : "");
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
