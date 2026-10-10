"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function RouteMap({ points }: { points: [number, number][] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || points.length < 2) return;
    const map = L.map(el.current, { zoomControl: false, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(map);
    const line = L.polyline(points, { color: "#F24A00", weight: 5, opacity: 0.95, lineJoin: "round" }).addTo(map);
    const dot = (p: [number, number], c: string) => L.circleMarker(p, { radius: 7, color: "#fff", weight: 3, fillColor: c, fillOpacity: 1 }).addTo(map);
    dot(points[0], "#1C9E5F"); dot(points[points.length - 1], "#F24A00");
    map.fitBounds(line.getBounds(), { padding: [28, 28] });
    return () => { map.remove(); };
  }, [points]);
  return <div ref={el} className="h-72 w-full overflow-hidden rounded-xl bg-surface-2" role="img" aria-label="Carte du parcours" />;
}
