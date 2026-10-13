"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";

type P = { lat: number; lng: number; ele?: number; t: number };
type Mode = "slope" | "speed";
const rad = Math.PI / 180;
const dist = (a: P, b: P) => { const x = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };
const BLUE: [number, number, number] = [59, 130, 246], GREY: [number, number, number] = [156, 163, 175], YELLOW: [number, number, number] = [250, 204, 21], RED: [number, number, number] = [239, 68, 68];

/** Dégradé à plusieurs couleurs : t de 0 à 1. */
function ramp(t: number, stops: [number, number, number][], at: number[]): string {
  const x = Math.max(0, Math.min(1, t)); let i = 0;
  while (i < at.length - 2 && x > at[i + 1]) i++;
  const k = (x - at[i]) / (at[i + 1] - at[i]), a = stops[i], b = stops[i + 1];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
}
const SLOPE = { stops: [BLUE, GREY, RED], at: [0, 10 / 22, 1], lo: -10, hi: 12 }; // pente en % : de -10 à +12

function analyse(pts: P[]) {
  const n = pts.length, d = [0]; for (let i = 1; i < n; i++) d.push(d[i - 1] + dist(pts[i - 1], pts[i]));
  const w = 3, win = (i: number) => [Math.max(0, i - w), Math.min(n - 1, i + w)] as const;
  const slope = pts.map((_, i) => { const [a, b] = win(i), dd = d[b] - d[a], e0 = pts[a].ele, e1 = pts[b].ele; return dd > 5 && e0 != null && e1 != null ? ((e1 - e0) / dd) * 100 : 0; });
  const speed = pts.map((_, i) => { const [a, b] = win(i), dt = (pts[b].t - pts[a].t) / 1000; return dt > 0 ? ((d[b] - d[a]) / dt) * 3.6 : 0; });
  const sorted = [...speed].sort((x, y) => x - y);
  return { slope, speed, vmin: sorted[Math.floor(n * 0.05)] ?? 0, vmax: sorted[Math.floor(n * 0.95)] ?? 1, hasEle: pts.some((p) => p.ele != null), hasSpeed: speed.some((v) => v > 0.5) };
}

/** Carte topographique (OpenTopoMap) : le tracé est coloré point par point selon la pente ou la vitesse. */
export default function InteractiveTopoMap({ points }: { points: P[] }) {
  const el = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), layer = useRef<L.LayerGroup | null>(null);
  const info = useMemo(() => analyse(points), [points]);
  const [mode, setMode] = useState<Mode>(info.hasEle ? "slope" : "speed");

  useEffect(() => {
    if (!el.current || points.length < 2) return;
    const m = L.map(el.current, { zoomControl: false, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: "© contributeurs OpenStreetMap, SRTM | Style : © OpenTopoMap (CC-BY-SA)" }).addTo(m);
    layer.current = L.layerGroup().addTo(m); map.current = m;
    const line = L.polyline(points.map((p) => [p.lat, p.lng] as [number, number]));
    m.fitBounds(line.getBounds(), { padding: [28, 28] });
    const dot = (p: P, c: string) => L.circleMarker([p.lat, p.lng], { radius: 7, color: "#fff", weight: 3, fillColor: c, fillOpacity: 1 }).addTo(m);
    dot(points[0], "#1C9E5F"); dot(points[points.length - 1], "#F24A00");
    return () => { m.remove(); map.current = null; };
  }, [points]);

  useEffect(() => {
    const g = layer.current; if (!g) return;
    g.clearLayers();
    for (let i = 1; i < points.length; i++) {
      const color = mode === "slope" ? ramp((info.slope[i] - SLOPE.lo) / (SLOPE.hi - SLOPE.lo), SLOPE.stops, SLOPE.at) : ramp((info.speed[i] - info.vmin) / ((info.vmax - info.vmin) || 1), [BLUE, YELLOW, RED], [0, 0.5, 1]);
      L.polyline([[points[i - 1].lat, points[i - 1].lng], [points[i].lat, points[i].lng]], { color, weight: 5, opacity: 0.95, lineCap: "round" }).addTo(g);
    }
  }, [mode, points, info]);

  return (
    <div>
      <div className="mb-2 flex gap-1 rounded-full bg-surface-2 p-1" role="tablist" aria-label="Coloration du tracé">
        {([["slope", "Pente", info.hasEle], ["speed", "Vitesse", info.hasSpeed]] as const).map(([k, l, ok]) => (
          <button key={k} role="tab" aria-selected={mode === k} disabled={!ok} onClick={() => setMode(k)} className={cn("min-h-10 flex-1 rounded-full text-sm disabled:opacity-40", mode === k ? "bg-surface font-bold shadow" : "text-ink-soft")}>{l}</button>
        ))}
      </div>
      <div ref={el} className="h-72 w-full overflow-hidden rounded-xl bg-surface-2" role="img" aria-label="Carte topographique du parcours" />
      <div className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
        <span>{mode === "slope" ? "Descente" : `${Math.round(info.vmin)} km/h`}</span>
        <i className="h-2 flex-1 rounded-full" style={{ background: mode === "slope" ? "linear-gradient(90deg, rgb(59,130,246), rgb(156,163,175), rgb(239,68,68))" : "linear-gradient(90deg, rgb(59,130,246), rgb(250,204,21), rgb(239,68,68))" }} />
        <span>{mode === "slope" ? "Montée raide" : `${Math.round(info.vmax)} km/h`}</span>
      </div>
    </div>
  );
}
