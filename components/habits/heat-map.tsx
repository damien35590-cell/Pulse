"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { BASEMAP_URL, basemapOptions, getMapTheme, useMapTheme } from "@/lib/map/basemap";
import type { Junction } from "@/lib/habits/grid";

type Props = {
  lat0: number;
  cellM: number;
  /** [ligne, colonne, nombre de sorties] (lib/habits/grid.ts). */
  cells: [number, number, number][];
  junctions?: Junction[];
  /** Tracé mis en avant (classique choisi). */
  highlight?: [number, number][] | null;
  /** Point mis en avant (bifurcation choisie). */
  focus?: { lat: number; lng: number } | null;
  className?: string;
};

const token = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v ? `rgb(${v.split(/\s+/).join(",")})` : fallback;
};
/** Au-delà, la carte reste fluide sur téléphone : on garde les cases les plus fréquentées. */
const MAX_CELLS = 12_000;

/** Carte de chaleur de tes passages (une case de 40 m par endroit, plus foncée quand tu y passes souvent), rendue en canvas. */
export default function HeatMap({ lat0, cellM, cells, junctions, highlight, focus, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const base = useRef<L.TileLayer | null>(null);
  const theme = useMapTheme();
  // Changement de thème : seules les tuiles changent, la vue reste.
  useEffect(() => { base.current?.setUrl(BASEMAP_URL[theme]); }, [theme]);
  const top = useRef<L.LayerGroup | null>(null);
  const home = useRef<L.LatLngBounds | null>(null);

  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false, preferCanvas: true });
    m.attributionControl.setPrefix(false);
    base.current = L.tileLayer(BASEMAP_URL[getMapTheme()], basemapOptions).addTo(m);
    const renderer = L.canvas({ padding: 0.3 });
    const brand = token("brand-text", "#C6F432");
    const ky = 110_540, kx = 111_320 * Math.cos((lat0 * Math.PI) / 180);
    const list = cells.length > MAX_CELLS ? [...cells].sort((a, b) => b[2] - a[2]).slice(0, MAX_CELLS) : cells;
    const max = Math.max(2, ...list.map((c) => c[2]));
    const bounds = L.latLngBounds([]);
    for (const [r, c, n] of list) {
      const s = (r * cellM) / ky, w = (c * cellM) / kx, nth = ((r + 1) * cellM) / ky, e = ((c + 1) * cellM) / kx;
      const b = L.latLngBounds([s, w], [nth, e]);
      // Échelle logarithmique : un passage reste visible, les chemins quotidiens ressortent.
      const o = 0.18 + 0.67 * (Math.log(n) / Math.log(max));
      L.rectangle(b, { renderer, stroke: false, fillColor: brand, fillOpacity: Math.min(0.85, o), interactive: false }).addTo(m);
      if (n >= 2) bounds.extend(b);
    }
    if (!bounds.isValid()) for (const [r, c] of list) bounds.extend([(r * cellM) / ky, (c * cellM) / kx]);
    home.current = bounds.isValid() ? bounds : null;
    if (home.current) m.fitBounds(home.current, { padding: [16, 16] }); else m.setView([lat0, 2.4], 6);
    top.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => { m.remove(); map.current = null; top.current = null; };
  }, [lat0, cellM, cells]);

  // Bifurcations, tracé et point mis en avant : redessinés sans recréer la carte.
  useEffect(() => {
    const m = map.current, g = top.current;
    if (!m || !g) return;
    g.clearLayers();
    const ink = token("ink", "#F5F5F7"), ring = token("surface", "#141417"), warn = token("warn", "#F59E0B");
    for (const j of junctions ?? []) {
      L.circleMarker([j.lat, j.lng], { radius: 5, color: ring, weight: 2, fillColor: warn, fillOpacity: 1, interactive: false }).addTo(g);
    }
    if (highlight && highlight.length > 1) {
      const line = L.polyline(highlight, { color: ink, weight: 4, opacity: 0.95, lineJoin: "round", interactive: false }).addTo(g);
      m.fitBounds(line.getBounds(), { padding: [24, 24] });
    } else if (focus) {
      L.circleMarker([focus.lat, focus.lng], { radius: 11, color: ink, weight: 3, fillOpacity: 0, interactive: false }).addTo(g);
      m.setView([focus.lat, focus.lng], Math.max(m.getZoom(), 16));
    } else if (home.current) {
      m.fitBounds(home.current, { padding: [16, 16] });
    }
  }, [cells, junctions, highlight, focus]);

  return <div ref={el} className={cn("isolate h-80 w-full overflow-hidden rounded-card bg-surface-2", className)} role="img" aria-label="Carte de chaleur de tes sorties" />;
}
