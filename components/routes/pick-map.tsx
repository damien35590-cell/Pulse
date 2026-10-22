"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

type LatLng = { lat: number; lng: number };
type Props = {
  /** Vue de départ quand aucun point n'est choisi (domicile, position) ; sinon la France entière. */
  center: LatLng | null;
  value: LatLng | null;
  onPick: (p: LatLng) => void;
  className?: string;
};

const FRANCE: L.LatLngTuple = [46.6, 2.4];
const token = (name: string, fallback: string) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v ? `rgb(${v.split(/\s+/).join(",")})` : fallback;
};

/** Carte où l'on touche pour poser le point de départ. Chargée via place-picker (Leaflet = navigateur uniquement). */
export default function PickMap({ center, value, onPick, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.CircleMarker | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!el.current) return;
    const start = value ?? center;
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false }).setView(start ? [start.lat, start.lng] : FRANCE, start ? (value ? 15 : 13) : 5);
    m.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => { tap(8); pick.current({ lat: e.latlng.lat, lng: e.latlng.lng }); });
    map.current = m;
    return () => { m.remove(); map.current = null; pin.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Point choisi (recherche ou toucher) : repère déplacé, carte recentrée s'il sort du cadre.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) { pin.current?.remove(); pin.current = null; return; }
    const ll: L.LatLngTuple = [value.lat, value.lng];
    if (!pin.current) pin.current = L.circleMarker(ll, { radius: 9, color: token("surface", "#141417"), weight: 3, fillColor: token("brand", "#E8804F"), fillOpacity: 1, interactive: false }).addTo(m);
    else pin.current.setLatLng(ll);
    if (!m.getBounds().pad(-0.15).contains(ll) || m.getZoom() < 12) m.setView(ll, Math.max(m.getZoom(), 15));
  }, [value?.lat, value?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={cn("isolate h-48 w-full overflow-hidden rounded-tile bg-surface-2", className)} role="application" aria-label="Carte : touche pour choisir le départ" />;
}
