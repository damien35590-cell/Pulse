"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/lib/polyline";
import { TILE, project } from "@/lib/map/track";
import { BASEMAP, BASEMAP_CREDIT, tileUrl, useMapTheme, type BasemapStyle, type MapTheme } from "@/lib/map/basemap";

const PAD = 0.12, MAX_ZOOM = 16;

/** Cadrage : plus grand zoom entier où la trace tient dans le cadre (marge de 12 %), tuiles à poser, tracé en px. */
function layout(points: LatLng[], w: number, h: number) {
  const p0 = points.map((p) => project(p, 0));
  const xs = p0.map((p) => p[0]), ys = p0.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const fit = Math.min((w * (1 - 2 * PAD)) / (x1 - x0 || 1e-9), (h * (1 - 2 * PAD)) / (y1 - y0 || 1e-9));
  const z = Math.max(0, Math.min(MAX_ZOOM, Math.floor(Math.log2(fit))));
  const s = 2 ** z, left = ((x0 + x1) / 2) * s - w / 2, top = ((y0 + y1) / 2) * s - h / 2, n = s;
  const tiles: { key: string; x: number; y: number; left: number; top: number }[] = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + h - 1) / TILE); ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w - 1) / TILE); tx++) {
      tiles.push({ key: `${z}/${tx}/${ty}`, x: ((tx % n) + n) % n, y: ty, left: tx * TILE - left, top: ty * TILE - top });
    }
  }
  const P = p0.map(([x, y]) => [x * s - left, y * s - top] as const);
  const d = "M" + P.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L");
  // Boucle : le départ et l'arrivée se confondent (moins de ~30 m) → un seul point.
  const k = Math.cos((points[0][0] * Math.PI) / 180), a = points[0], b = points[points.length - 1];
  const loop = Math.hypot((b[0] - a[0]) * 111_320, (b[1] - a[1]) * 111_320 * k) < 30;
  return { z, tiles, d, start: P[0], end: P[P.length - 1], loop };
}

/**
 * Vignette statique d'un parcours pour le fil : tuiles Stadia Maps posées en <img>, tracé en SVG projeté pareil.
 * Aucune bibliothèque de carte, aucune interaction : la carte du fil reste un simple lien vers le détail.
 * Attendu : une trace déjà simplifiée (~200 points, lib/map/track.ts → previewTrack).
 */
export function RoutePreview({ points, className, basemap = BASEMAP, theme: forced }: { points: LatLng[]; className?: string; basemap?: Record<MapTheme, BasemapStyle>; theme?: MapTheme }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const appTheme = useMapTheme();
  const theme = forced ?? appTheme;
  const { style, filter } = basemap[theme];

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const h = Math.round(w / 2);
  const g = useMemo(() => (w > 0 && points.length > 1 ? layout(points, w, h) : null), [points, w, h]);
  // Tuiles chargées pour le cadrage courant : squelette tant qu'il en manque.
  const frame = g ? `${style}:${w}:${g.z}` : "";
  const [loaded, setLoaded] = useState({ frame: "", n: 0 });
  const done = (f: string) => setLoaded((l) => (l.frame === f ? { frame: f, n: l.n + 1 } : { frame: f, n: 1 }));
  const ready = !!g && loaded.frame === frame && loaded.n >= g.tiles.length;

  return (
    <div ref={box} role="img" aria-label="Tracé du parcours" className={cn("relative isolate aspect-[2/1] w-full select-none overflow-hidden bg-surface-2", className)}>
      {!ready && <div aria-hidden className="absolute inset-0 animate-pulse bg-surface-2" />}
      {g && (
        <div aria-hidden className={cn("pointer-events-none absolute inset-0 transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}>
          <div className="absolute inset-0" style={{ filter }}>
          {g.tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element -- tuiles externes, taille fixe : pas besoin de next/image
            <img
              key={`${style}/${t.key}`}
              src={tileUrl(theme, g.z, t.x, t.y, false, style)}
              srcSet={`${tileUrl(theme, g.z, t.x, t.y, true, style)} 2x`}
              alt=""
              width={TILE}
              height={TILE}
              loading="lazy"
              decoding="async"
              draggable={false}
              onLoad={() => done(frame)}
              onError={(e) => { e.currentTarget.style.visibility = "hidden"; done(frame); }} /* tuile en erreur : le fond surface-2 reste, le tracé aussi */
              className="absolute max-w-none"
              style={{ left: t.left, top: t.top, width: TILE, height: TILE }}
            />
          ))}
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="absolute inset-0" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d={g.d} className="stroke-bg/60" strokeWidth={4} />
            <path d={g.d} className="stroke-brand" strokeWidth={2.5} />
            {!g.loop && <circle cx={g.end[0]} cy={g.end[1]} r={4.5} className="fill-ink stroke-surface" strokeWidth={2} />}
            <circle cx={g.start[0]} cy={g.start[1]} r={4.5} className="fill-good stroke-surface" strokeWidth={2} />
          </svg>
          <span className="absolute bottom-1.5 right-1.5 rounded-full bg-surface/70 px-1.5 text-micro text-ink-soft backdrop-blur">{BASEMAP_CREDIT}</span>
        </div>
      )}
    </div>
  );
}
