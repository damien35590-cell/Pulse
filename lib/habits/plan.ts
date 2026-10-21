/**
 * Tes classiques adaptés au temps dispo, et le curseur Habitude ↔ Découverte du générateur.
 * - Tel quel : la vraie trace de ta sortie la plus représentative, si elle tient dans le temps visé.
 * - Version longue : un détour par une bifurcation que tu prends parfois (sinon d'un côté ou de l'autre du tracé).
 * - Version courte : un raccourci entre deux points du tracé proches à vol d'oiseau.
 * Fonctions pures (tests : tools/test-habits.ts) ; lib/habits/variants.ts appelle ORS.
 */
import { bearing, classicTitle, dist, resample, type Heat, type Junction, type LL, type Proj } from "./grid";

export type HabitMode = "habit" | "balanced" | "discover";
export const HABIT_MODES: HabitMode[] = ["habit", "balanced", "discover"];

/** Poids de la familiarité dans le score global : + en Habitude, − en Découverte. */
export const FAMILIAR_WEIGHT = 0.35;
export const habitBonus = (mode: HabitMode, familiar: number) => (mode === "habit" ? FAMILIAR_WEIGHT * familiar : mode === "discover" ? -FAMILIAR_WEIGHT * familiar : 0);

/** « 72 % sur tes chemins habituels » / « 85 % de chemins nouveaux » (rien entre les deux en mode Équilibre). */
export function familiarText(mode: HabitMode, familiar: number) {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  if (mode === "discover" || (mode === "balanced" && familiar <= 0.2)) return familiar >= 0.95 ? null : `${pct(1 - familiar)} de chemins nouveaux`;
  if (mode === "habit" || familiar >= 0.6) return familiar >= 0.05 ? `${pct(familiar)} sur tes chemins habituels` : null;
  return null;
}

/** Réglages des variantes. */
export const START_NEAR_M = 600;
export const MAX_CLASSICS_TRIED = 2;
export const CALLS_PER_CLASSIC = 4;
const SHORTCUT_MAX_GAP_M = 900;
/** Un raccourci entre deux points fait environ 1,3 fois la distance à vol d'oiseau. */
const DETOUR_FACTOR = 1.3;
const ON_ROUTE_M = 40;

export type ClassicMeta = {
  classicId: string; name: string | null; count: number; kind: "asis" | "longer" | "shorter";
  deltaMin: number; viaName: string | null; viaJunction: boolean; loop: boolean;
};

/** Points de passage le long du classique : au plus 45, espacés d'au moins 400 m (assez serrés pour qu'ORS suive ton chemin). */
export function waypointsOf(p: Proj, pts: LL[]) {
  const len = pts.reduce((s, q, i) => (i ? s + dist(p, pts[i - 1], q) : 0), 0);
  const step = Math.max(400, len / 44);
  const wps = resample(p, pts, step);
  const cum = [0];
  for (let i = 1; i < wps.length; i++) cum.push(cum[i - 1] + dist(p, wps[i - 1], wps[i]));
  return { wps, cum, len };
}

/** Raccourcis : paires (i, j) du tracé proches à vol d'oiseau ; on garde celles qui économisent environ `needM`. */
export function shortcuts(p: Proj, wps: LL[], cum: number[], needM: number, max = 2) {
  const out: { i: number; j: number; saving: number }[] = [];
  for (let i = 1; i < wps.length - 2; i++) for (let j = i + 2; j < wps.length - 1; j++) {
    const gap = dist(p, wps[i], wps[j]);
    if (gap > SHORTCUT_MAX_GAP_M) continue;
    out.push({ i, j, saving: cum[j] - cum[i] - DETOUR_FACTOR * gap });
  }
  return out.filter((x) => x.saving > needM * 0.4).sort((a, b) => Math.abs(a.saving - needM) - Math.abs(b.saving - needM)).slice(0, max);
}

const offset = (p: Proj, ll: LL, deg: number, m: number): LL => {
  const r = (deg * Math.PI) / 180;
  return [ll[0] + (Math.cos(r) * m) / p.ky, ll[1] + (Math.sin(r) * m) / p.kx];
};
const distToLine = (p: Proj, ll: LL, line: LL[]) => line.reduce((m, q) => Math.min(m, dist(p, ll, q)), Infinity);

export type Detour = { at: number; via: LL; junction: boolean };

/**
 * Détours possibles pour allonger de `needM` : d'abord les branches de tes bifurcations que le classique ne prend pas,
 * puis des points de part et d'autre du tracé (au quart, à la moitié, aux trois quarts), triés selon le mode.
 */
export function detours(p: Proj, wps: LL[], needM: number, junctions: Junction[], heat: Heat | null, mode: HabitMode, max = 3): Detour[] {
  const r = needM / 2; // aller-retour vers le point de passage ≈ 2 × r
  const dense = resample(p, wps, 50);
  const fromJunctions: Detour[] = [];
  for (const j of junctions) {
    const jl: LL = [j.lat, j.lng];
    if (distToLine(p, jl, dense) > ON_ROUTE_M) continue;
    for (const b of j.branches) {
      if (distToLine(p, [b.lat, b.lng], dense) <= 60) continue; // la branche que prend déjà le classique
      const at = wps.reduce((best, q, i) => (dist(p, q, jl) < dist(p, wps[best], jl) ? i : best), 0);
      if (at === 0 || at >= wps.length - 1) continue;
      fromJunctions.push({ at, via: offset(p, jl, b.bearing, Math.max(200, r)), junction: true });
    }
  }
  const geometric: Detour[] = [];
  for (const f of [0.5, 0.25, 0.75]) {
    const at = Math.max(1, Math.min(wps.length - 2, Math.round(f * (wps.length - 1))));
    const h = bearing(p, wps[at - 1], wps[at + 1]);
    for (const side of [-90, 90]) {
      const via = offset(p, wps[at], h + side, Math.max(200, r));
      if (distToLine(p, via, dense) > r * 0.6) geometric.push({ at, via, junction: false });
    }
  }
  // Habitude : vers tes chemins connus ; Découverte : vers l'inconnu ; Équilibre : l'ordre géométrique.
  const known = (d: Detour) => (heat ? heat.at(d.via) : 0);
  if (mode === "habit") geometric.sort((a, b) => known(b) - known(a));
  if (mode === "discover") geometric.sort((a, b) => known(a) - known(b));
  return [...(mode === "discover" ? [] : fromJunctions), ...geometric].slice(0, max);
}

/** Nom affiché : « Ton classique », « Ton classique en plus long »… */
export function classicLabel(m: ClassicMeta) {
  return m.kind === "asis" ? "Ton classique" : m.kind === "longer" ? "Ton classique, en plus long" : "Ton classique, en plus court";
}

/** « Boucle vers l'Étang · faite 14 fois · +9 min par la bifurcation que tu prends parfois » */
export function classicWhy(m: ClassicMeta) {
  const parts = [classicTitle(m), `faite ${m.count} fois`];
  if (m.kind === "longer") parts.push(`+${Math.max(1, m.deltaMin)} min ${m.viaJunction ? "par la bifurcation que tu prends parfois" : "par un détour"}${m.viaName ? ` vers ${m.viaName}` : ""}`);
  if (m.kind === "shorter") parts.push(`${Math.min(-1, m.deltaMin)} min par un raccourci`);
  return parts.join(" · ");
}
