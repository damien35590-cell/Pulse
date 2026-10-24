"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { Segmented } from "@/components/ui/segmented";
import { BASEMAP_URL, basemapOptions, getMapTheme, useMapTheme } from "@/lib/map/basemap";

export type TrackPoint = { lat: number; lng: number; ele?: number; t?: number };
type Mode = "slope" | "speed";
type RGB = [number, number, number];
const rad = Math.PI / 180;
const dist = (a: TrackPoint, b: TrackPoint) => { const x = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2; return 12742000 * Math.asin(Math.sqrt(x)); };

/** Token du thème (« 59 130 246 ») en triplet RVB, pour les couleurs calculées point par point. */
const rgbToken = (name: string): RGB => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim().split(/\s+/).map(Number);
  return v.length === 3 && v.every((n) => Number.isFinite(n)) ? (v as RGB) : [138, 138, 149];
};
const css = (c: RGB) => `rgb(${c.join(",")})`;

/** Dégradé à plusieurs couleurs : t de 0 à 1. */
function ramp(t: number, stops: RGB[], at: number[]): string {
  const x = Math.max(0, Math.min(1, t)); let i = 0;
  while (i < at.length - 2 && x > at[i + 1]) i++;
  const k = (x - at[i]) / (at[i + 1] - at[i]), a = stops[i], b = stops[i + 1];
  return `rgb(${a.map((v, j) => Math.round(v + (b[j] - v) * Math.max(0, Math.min(1, k)))).join(",")})`;
}
// Pente en % : de -10 (descente, z2) à +12 (montée raide, bad), neutre à plat. Vitesse : z2 → z4 → z5.
const SLOPE = { tokens: ["z2", "ink-mute", "bad"], at: [0, 10 / 22, 1], lo: -10, hi: 12 };
const SPEED = { tokens: ["z2", "z4", "z5"], at: [0, 0.5, 1] };
const legend = (tokens: string[]) => `linear-gradient(90deg, ${tokens.map((t) => `rgb(var(--${t}))`).join(", ")})`;

function analyse(pts: TrackPoint[]) {
  const n = pts.length, d = [0]; for (let i = 1; i < n; i++) d.push(d[i - 1] + dist(pts[i - 1], pts[i]));
  const w = 3, win = (i: number) => [Math.max(0, i - w), Math.min(n - 1, i + w)] as const;
  const slope = pts.map((_, i) => { const [a, b] = win(i), dd = d[b] - d[a], e0 = pts[a].ele, e1 = pts[b].ele; return dd > 5 && e0 != null && e1 != null ? ((e1 - e0) / dd) * 100 : 0; });
  const speed = pts.map((_, i) => { const [a, b] = win(i), t0 = pts[a].t, t1 = pts[b].t, dt = t0 != null && t1 != null ? (t1 - t0) / 1000 : 0; return dt > 0 ? ((d[b] - d[a]) / dt) * 3.6 : 0; });
  const sorted = [...speed].sort((x, y) => x - y);
  return { slope, speed, vmin: sorted[Math.floor(n * 0.05)] ?? 0, vmax: sorted[Math.floor(n * 0.95)] ?? 1, hasEle: pts.some((p) => p.ele != null), hasSpeed: speed.some((v) => v > 0.5) };
}

const COARSE = "(pointer: coarse)";
const HINT_TOUCH = "Utilise deux doigts pour déplacer la carte", HINT_WHEEL = "Ctrl + molette pour zoomer";

/**
 * Carte du parcours (fond CARTO selon le thème) : tracé coloré point par point selon la pente ou la vitesse, sur un halo.
 * Gestes coopératifs : un doigt fait défiler la page, deux doigts déplacent / zooment la carte ; sur PC, Ctrl + molette.
 * En plein écran, tous les gestes habituels reviennent. `cursor` : position suivie depuis le profil d'altitude.
 */
export default function InteractiveTopoMap({ points, cursor, className }: { points: TrackPoint[]; cursor?: [number, number] | null; className?: string }) {
  const el = useRef<HTMLDivElement>(null), map = useRef<L.Map | null>(null), base = useRef<L.TileLayer | null>(null);
  const layer = useRef<L.LayerGroup | null>(null), bounds = useRef<L.LatLngBounds | null>(null), dot = useRef<L.CircleMarker | null>(null);
  const info = useMemo(() => analyse(points), [points]);
  const [mode, setMode] = useState<Mode>(info.hasEle ? "slope" : "speed");
  const [full, setFull] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const fullRef = useRef(full);
  fullRef.current = full;
  const theme = useMapTheme();
  const colored = info.hasEle || info.hasSpeed;

  // Carte : créée une fois par trace, affichée tout de suite (pas de « toucher pour activer »).
  useEffect(() => {
    const box = el.current;
    if (!box || points.length < 2) return;
    const touch = matchMedia(COARSE).matches;
    const m = L.map(box, { zoomControl: !touch, scrollWheelZoom: false, dragging: !touch, touchZoom: true, zoomSnap: 0.5, preferCanvas: true });
    m.attributionControl.setPrefix(false);
    base.current = L.tileLayer(BASEMAP_URL[getMapTheme()], basemapOptions).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    bounds.current = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    m.fitBounds(bounds.current, { padding: [24, 24] });
    map.current = m;

    // Indice discret quand le geste ne pilote pas la carte (un doigt qui glisse, molette sans Ctrl).
    let timer: ReturnType<typeof setTimeout> | undefined, start: { x: number; y: number } | null = null, lastWheel = 0;
    const show = (text: string) => { setHint(text); clearTimeout(timer); timer = setTimeout(() => setHint(null), 1400); };
    const onStart = (e: TouchEvent) => { start = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null; if (e.touches.length > 1) setHint(null); };
    const onMove = (e: TouchEvent) => {
      if (fullRef.current || !start || e.touches.length !== 1) return;
      if (Math.hypot(e.touches[0].clientX - start.x, e.touches[0].clientY - start.y) > 10) { start = null; show(HINT_TOUCH); }
    };
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !fullRef.current) { show(HINT_WHEEL); return; }
      e.preventDefault(); // Ctrl + molette (ou pincement du pavé tactile) : zoom de la carte, pas de la page
      const now = Date.now();
      if (now - lastWheel < 120) return;
      lastWheel = now;
      m.setZoomAround(m.mouseEventToContainerPoint(e as unknown as MouseEvent), m.getZoom() + (e.deltaY < 0 ? 0.5 : -0.5));
    };
    box.addEventListener("touchstart", onStart, { passive: true });
    box.addEventListener("touchmove", onMove, { passive: true });
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(timer);
      box.removeEventListener("touchstart", onStart); box.removeEventListener("touchmove", onMove); box.removeEventListener("wheel", onWheel);
      m.remove(); map.current = null; base.current = null; dot.current = null;
    };
  }, [points]);

  useEffect(() => { base.current?.setUrl(BASEMAP_URL[theme]); }, [theme]);

  // Tracé : halo sous la ligne colorée, départ (good) et arrivée (ink, anneau surface). Couleurs relues à chaque thème.
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    const ll = points.map((p) => [p.lat, p.lng] as [number, number]);
    const bg = rgbToken("bg"), surface = rgbToken("surface"), ink = rgbToken("ink"), good = rgbToken("good"), brand = rgbToken("brand-text");
    L.polyline(ll, { color: css(bg), opacity: 0.6, weight: 8, lineCap: "round", lineJoin: "round", interactive: false }).addTo(g);
    if (!colored) L.polyline(ll, { color: css(brand), weight: 4, lineCap: "round", lineJoin: "round", interactive: false }).addTo(g);
    else {
      const slope = SLOPE.tokens.map(rgbToken), speed = SPEED.tokens.map(rgbToken);
      for (let i = 1; i < points.length; i++) {
        const color = mode === "slope" ? ramp((info.slope[i] - SLOPE.lo) / (SLOPE.hi - SLOPE.lo), slope, SLOPE.at) : ramp((info.speed[i] - info.vmin) / ((info.vmax - info.vmin) || 1), speed, SPEED.at);
        L.polyline([ll[i - 1], ll[i]], { color, weight: 4, lineCap: "round", interactive: false }).addTo(g);
      }
    }
    const marker = (p: [number, number], fill: RGB) => L.circleMarker(p, { radius: 6, color: css(surface), weight: 2.5, fillColor: css(fill), fillOpacity: 1, interactive: false }).addTo(g);
    const first = ll[0], last = ll[ll.length - 1];
    if (L.latLng(first).distanceTo(last) > 30) marker(last, ink); // boucle : un seul point
    marker(first, good);
    dot.current?.setStyle({ color: css(surface), fillColor: css(brand) });
  }, [mode, points, info, colored, theme]);

  // Point mobile synchronisé avec le profil d'altitude.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!cursor) { dot.current?.remove(); return; }
    if (!dot.current) dot.current = L.circleMarker(cursor, { radius: 7, color: css(rgbToken("surface")), weight: 3, fillColor: css(rgbToken("brand-text")), fillOpacity: 1, interactive: false });
    dot.current.setLatLng(cursor);
    if (!m.hasLayer(dot.current)) dot.current.addTo(m);
    dot.current.bringToFront(); // au-dessus du tracé, même redessiné depuis
  }, [cursor]);

  // Plein écran : gestes à un doigt, page figée, Échap ou le bouton referme ; la carte se recadre sur la trace.
  useEffect(() => {
    const m = map.current;
    if (m) {
      if (full) m.dragging.enable(); else if (matchMedia(COARSE).matches) m.dragging.disable();
      m.invalidateSize();
      if (bounds.current) m.fitBounds(bounds.current, { padding: [24, 24] });
    }
    if (!full) return;
    setHint(null);
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [full]);

  const tabs = ([["slope", "Pente", info.hasEle], ["speed", "Vitesse", info.hasSpeed]] as const).filter(([, , ok]) => ok);
  const scale = mode === "slope" ? SLOPE : SPEED;

  return (
    <div className={className}>
      {tabs.length > 1 && (
        <Segmented className="mb-3" options={tabs.map(([value, label]) => ({ value, label }))} value={mode} onChange={setMode} />
      )}
      <div className={cn("isolate overflow-hidden bg-surface-2", full ? "fixed inset-0 z-50" : "relative h-[min(60vw,360px)] w-full rounded-card")}>
        <div ref={el} className="size-full" role="img" aria-label="Carte du parcours" />
        <div
          aria-live="polite"
          className={cn(
            "pointer-events-none absolute inset-0 z-[1000] grid place-items-center bg-bg/50 p-6 transition-opacity duration-200",
            hint ? "opacity-100" : "opacity-0",
          )}
        >
          {hint && <p className="rounded-full bg-surface/90 px-4 py-2 text-center text-sm font-semibold text-ink shadow-pop">{hint}</p>}
        </div>
        <button
          type="button"
          onClick={() => { tap(6); setFull((f) => !f); }}
          aria-label={full ? "Réduire la carte" : "Carte en plein écran"}
          className={cn(ui.iconBtn, "absolute right-2 z-[1000] bg-surface/90 shadow-pop backdrop-blur", full ? "top-[calc(0.5rem_+_env(safe-area-inset-top))]" : "top-2")}
        >
          {full ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
        </button>
      </div>
      {colored && (
        <div className="mt-2 flex items-center gap-2 font-num text-xs tabular-nums text-ink-soft">
          <span>{mode === "slope" ? "Descente" : `${Math.round(info.vmin)} km/h`}</span>
          <i aria-hidden className="h-2 flex-1 rounded-full" style={{ background: legend(scale.tokens) }} />
          <span>{mode === "slope" ? "Montée raide" : `${Math.round(info.vmax)} km/h`}</span>
        </div>
      )}
    </div>
  );
}
