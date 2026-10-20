"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import type { RoutePoi } from "@/lib/routes/poi";
import { poiTitle } from "@/lib/routes/poi";
import { PoiIcon } from "@/components/routes/poi-icon";

type Props = {
  points: [number, number][];
  /** Points d'intérêt affichés avec une icône par type. */
  pois?: RoutePoi[];
  /** false : vignette figée (pas de glisser ni de zoom), pour une carte de liste. */
  interactive?: boolean;
  /** Bouton pour passer la carte en plein écran. */
  expandable?: boolean;
  className?: string;
};

/** Couleur d'un token du thème (« 252 76 2 ») au format accepté par Leaflet. */
const token = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v ? `rgb(${v.split(/\s+/).join(",")})` : fallback;
};

export default function RouteMap({ points, pois, interactive = true, expandable, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const bounds = useRef<L.LatLngBounds | null>(null);
  const [slots, setSlots] = useState<{ el: HTMLElement; poi: RoutePoi }[]>([]);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!el.current || points.length < 2) return;
    const still = !interactive;
    const m = L.map(el.current, {
      zoomControl: false, scrollWheelZoom: false, dragging: !still, touchZoom: !still, doubleClickZoom: !still, boxZoom: !still, keyboard: !still,
    });
    m.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(m);
    const brand = token("brand", "#FC4C02"), good = token("good", "#22C55E"), ring = token("surface", "#141417");
    const line = L.polyline(points, { color: brand, weight: still ? 4 : 5, opacity: 0.95, lineJoin: "round", interactive: false }).addTo(m);
    const dot = (p: [number, number], c: string) => L.circleMarker(p, { radius: still ? 5 : 7, color: ring, weight: 3, fillColor: c, fillOpacity: 1, interactive: false }).addTo(m);
    const first = points[0], last = points[points.length - 1];
    // Une boucle revient à son départ : un seul point.
    if (m.distance(first, last) > 30) dot(last, brand);
    dot(first, good);

    const markers = (pois ?? []).map((p) => {
      const mk = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: "", html: "", iconSize: [28, 28] }), keyboard: false, interactive: !still }).addTo(m);
      if (!still) mk.bindTooltip(p.name ?? poiTitle(p.type), { direction: "top", offset: [0, -14] });
      return mk;
    });
    setSlots(markers.map((mk, i) => ({ el: mk.getElement()!, poi: pois![i] })).filter((s) => s.el));

    bounds.current = line.getBounds();
    m.fitBounds(bounds.current, { padding: still ? [14, 14] : [28, 28] });
    map.current = m;
    return () => { m.remove(); map.current = null; setSlots([]); };
  }, [points, pois, interactive]);

  // Plein écran : la carte se recadre sur la boucle ; Échap ou le bouton referme.
  useEffect(() => {
    const m = map.current;
    if (m) { m.invalidateSize(); if (bounds.current) m.fitBounds(bounds.current, { padding: [28, 28] }); }
    if (!full) return;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [full]);

  return (
    <div className={cn("isolate overflow-hidden bg-surface-2", full ? "fixed inset-0 z-50" : cn("relative h-72 w-full rounded-xl", className))}>
      <div ref={el} className={cn("size-full", !interactive && "pointer-events-none")} role="img" aria-label="Carte du parcours" />
      {slots.map((s) => createPortal(<PoiIcon type={s.poi.type} marker />, s.el, s.poi.id))}
      {expandable && (
        <button
          type="button"
          onClick={() => { tap(6); setFull((f) => !f); }}
          aria-label={full ? "Réduire la carte" : "Carte en plein écran"}
          className={cn(ui.iconBtn, "absolute right-2 z-[1000] bg-surface/90 shadow-pop backdrop-blur", full ? "top-[calc(0.5rem_+_env(safe-area-inset-top))]" : "top-2")}
        >
          {full ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
        </button>
      )}
    </div>
  );
}
