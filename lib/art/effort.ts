/**
 * Séances « à effort structuré » (art du fil d'activités) : quand le ruban devient un EffortStrip à la place de la carte, et son étiquette.
 * Fonctions pures (tests : tools/test-zone-ribbon.ts).
 */
import type { RibbonSegment } from "./zone-ribbon";

/** Séances clés du programme de course (VMA, seuil) : la sortie qui les réalise s'affiche en EffortStrip. */
export const EFFORT_KINDS: readonly string[] = ["INTERVALS_SHORT", "INTERVALS_LONG", "THRESHOLD", "VMA_TEST"];

/**
 * Étiquette courte d'une séance prévue : « VMA courte · 10 × 400 m » → « 10×400 », « Seuil · 3 × 10′ » → « 3×10′ »,
 * « VMA courte · 10 × 30/30 » → « 10×30/30 ». Sans répétitions, le titre court s'il tient (« Test VMA (demi-Cooper) » → « Test VMA »), sinon rien.
 */
export function shortTitle(title: string): string | undefined {
  const m = title.match(/(\d+)\s*[×x]\s*(\d+(?:\/\d+)?)\s*(m\b|min\b|[′'’])?/i);
  if (m) return `${m[1]}×${m[2]}${m[3] && !/^m$/i.test(m[3]) ? "′" : ""}`;
  const t = (title.split("·").pop() ?? "").replace(/\s*\(.*?\)/g, "").trim();
  return t && t.length <= 10 ? t : undefined;
}

/**
 * Structure en intervalles lisible dans le ruban : au moins 4 blocs durs (Z4 et plus, zones voisines regroupées) séparés par du facile
 * (Z3 et moins), et 10 à 70 % du temps en dur (sinon c'est un tempo continu ou une sortie dont la FC dérive, pas des intervalles).
 */
export function hasIntervalStructure(ribbon: RibbonSegment[]): boolean {
  let blocks = 0, hard = 0, inBlock = false;
  for (const s of ribbon) {
    if (s.z >= 4) { hard += s.f; if (!inBlock) blocks++; inBlock = true; } else inBlock = false;
  }
  return blocks >= 4 && hard >= 0.1 && hard <= 0.7;
}

/**
 * Variante pour un ruban d'allure (GPS, plus bruité que la FC). Un bloc dur = au moins 2 tranches de suite en Z4+ (une seule = bruit,
 * ignorée) ; deux blocs ne sont distincts que s'ils sont séparés par de la récupération en Z1–Z2 (un simple Z3 ne sépare pas : ils fusionnent) ;
 * il en faut au moins 4, et 15 à 70 % du temps en Z4+ (hors tranches isolées).
 */
const BUCKET = 1 / 40;
export function hasPaceIntervalStructure(ribbon: RibbonSegment[]): boolean {
  let blocks = 0, hard = 0, run = 0, recovered = true, last = false;
  const close = () => { // fin d'une suite de Z4+
    if (run >= 2 * BUCKET - 1e-9) { if (recovered || !last) blocks++; hard += run; last = true; recovered = false; }
    run = 0;
  };
  for (const s of ribbon) {
    if (s.z >= 4) run += s.f;
    else { close(); if (s.z <= 2) recovered = true; }
  }
  close();
  return blocks >= 4 && hard >= 0.15 && hard <= 0.7;
}
