/**
 * Couverture « Toutes tes traces » (page Vous) : toutes les traces GPS en plein air superposées sur une même origine.
 * Pure (tests : tools/test-traces.ts) : le serveur calcule les chemins SVG, le client n'a rien à dessiner de lourd.
 * - Chaque trace est simplifiée, recentrée sur le milieu de sa boîte englobante : toutes partent de la même origine.
 * - Une seule échelle pour toutes : le 85e centile des tailles remplit la zone, les très longues sorties débordent (le SVG les coupe).
 * - Une trace en vedette : la plus récente qui tient dans la zone (sinon la plus récente), avec son point d'arrivée.
 */
import { decodePolyline } from "../polyline";
import { simplifyTrack } from "../map/track";

export const TRACES_W = 360;
export const TRACES_H = 180;
const PAD = 14;
const POINTS = 32;      // points par trace : assez pour une forme reconnaissable, léger à transporter
export const MAX_TRACES = 120;

export type TraceInput = { id: string; polyline: string; startedAt: Date | string };
export type TracesArt = {
  /** Chemins SVG (coordonnées 0..TRACES_W × 0..TRACES_H), tous sauf la vedette. */
  paths: string[];
  /** Trace en vedette : chemin et point d'arrivée. */
  hero: { d: string; end: [number, number] } | null;
  /** Nombre de traces dessinées (vedette comprise). */
  count: number;
};

type Local = { id: string; at: number; pts: [number, number][]; halfW: number; halfH: number };

/** Plan local centré sur la boîte englobante, x vers l'est et y vers le sud, longitude corrigée par cos(lat). */
function toLocal(t: TraceInput): Local | null {
  const raw = decodePolyline(t.polyline);
  if (raw.length < 2) return null;
  const pts = simplifyTrack(raw, POINTS);
  const k = Math.cos((pts.reduce((s, p) => s + p[0], 0) / pts.length) * Math.PI / 180);
  const xs = pts.map((p) => p[1] * k), ys = pts.map((p) => -p[0]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2];
  const halfW = (x1 - x0) / 2, halfH = (y1 - y0) / 2;
  if (!(halfW > 0 || halfH > 0)) return null; // immobile : rien à tracer
  return { id: t.id, at: +new Date(t.startedAt), pts: pts.map((_, i) => [xs[i] - cx, ys[i] - cy]), halfW, halfH };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function buildTracesArt(inputs: TraceInput[]): TracesArt {
  const locals = inputs.map(toLocal).filter((l): l is Local => !!l);
  if (!locals.length) return { paths: [], hero: null, count: 0 };

  // Taille d'une trace = la part de la zone qu'elle occupe à l'échelle 1 (la plus grande des deux directions)
  const innerW = TRACES_W / 2 - PAD, innerH = TRACES_H / 2 - PAD;
  const need = (l: Local) => Math.max(l.halfW / innerW, l.halfH / innerH);
  const sorted = locals.map(need).sort((a, b) => a - b);
  const ref = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.85))];
  const sc = 1 / ref; // le 85e centile remplit la zone exactement

  const draw = (l: Local) => {
    const P = l.pts.map(([x, y]): [number, number] => [r1(TRACES_W / 2 + x * sc), r1(TRACES_H / 2 + y * sc)]);
    return { d: "M" + P.map((p) => p[0] + "," + p[1]).join("L"), end: P[P.length - 1] };
  };

  const byRecent = [...locals].sort((a, b) => b.at - a.at);
  const heroSrc = byRecent.find((l) => need(l) <= ref) ?? byRecent[0];
  const hero = draw(heroSrc);
  return { paths: locals.filter((l) => l !== heroSrc).map((l) => draw(l).d), hero, count: locals.length };
}
