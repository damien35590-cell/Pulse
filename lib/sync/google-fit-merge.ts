/**
 * Google Fit coupe une sortie en plusieurs sessions (ou segments) à chaque pause. On les recolle avant l'import :
 * même type d'activité, moins de 10 min entre la fin de l'une et le début de la suivante.
 * Fonctions pures (tests : tools/test-gfit-merge.ts), partagées par la synchro et tools/fusionner-gfit.ts.
 */

/** Écart maximal entre deux morceaux d'une même sortie. */
export const MERGE_GAP_MS = 10 * 60 * 1000;

export type Piece = { type: string | number; startMs: number; endMs: number };

/** Morceaux triés par début, regroupés : même type, écart < 10 min. Chaque groupe garde l'ordre chronologique. */
export function groupPieces<T extends Piece>(list: T[]): T[][] {
  const out: T[][] = [];
  // Groupe en cours par type, avec sa fin : un autre type intercalé (marche pendant la pause) ne coupe pas ; un morceau inclus ne fait pas reculer la fin.
  const open = new Map<string | number, { g: T[]; endMs: number }>();
  for (const p of [...list].sort((a, b) => a.startMs - b.startMs)) {
    const cur = open.get(p.type);
    if (cur && p.startMs - cur.endMs < MERGE_GAP_MS) {
      cur.g.push(p);
      cur.endMs = Math.max(cur.endMs, p.endMs);
      continue;
    }
    const g = [p];
    out.push(g);
    open.set(p.type, { g, endMs: p.endMs });
  }
  return out;
}

/** Une sortie recollée : début du premier morceau, fin du dernier, temps en mouvement = somme des morceaux (un morceau inclus dans un autre ne compte pas deux fois). */
export function mergedSpan(g: Piece[]) {
  const startMs = g[0].startMs, endMs = Math.max(...g.map((p) => p.endMs));
  let movingMs = 0, reached = -Infinity;
  for (const p of g) { const from = Math.max(p.startMs, reached); if (p.endMs > from) movingMs += p.endMs - from; reached = Math.max(reached, p.endMs); }
  const movingS = Math.floor(movingMs / 1000);
  return { startMs, endMs, movingS, elapsedS: Math.max(0, Math.floor((endMs - startMs) / 1000)) };
}

/** Activités déjà en base (une ligne par morceau) → groupes d'au moins deux morceaux d'un même utilisateur. Pour le diagnostic et le rattrapage. */
export function groupFragments<A extends { userId: string; type: string; startedAt: Date; movingTimeS: number; elapsedTimeS?: number | null }>(acts: A[]): A[][] {
  const byUser = new Map<string, A[]>();
  for (const a of acts) byUser.set(a.userId, [...(byUser.get(a.userId) ?? []), a]);
  const out: A[][] = [];
  for (const list of byUser.values()) {
    const pieces = list.map((a) => ({ a, type: a.type, startMs: +a.startedAt, endMs: +a.startedAt + 1000 * Math.max(a.elapsedTimeS ?? 0, a.movingTimeS) }));
    for (const g of groupPieces(pieces)) if (g.length > 1) out.push(g.map((p) => p.a));
  }
  return out.sort((x, y) => +x[0].startedAt - +y[0].startedAt);
}

/**
 * Sessions d'abord : une session Google Fit (ce que l'appli Fit affiche, « Course à pied du midi ») fait foi. Les segments bruts d'activité,
 * que Fit réétiquette minute par minute (course / marche / inconnu), ne servent que pour le temps qu'aucune session ne couvre
 * (vélotaf et marches détectés automatiquement).
 */
export type FitSession = { id: string; startMs: number; endMs: number };
export const overlaps = (a: { startMs: number; endMs: number }, b: { startMs: number; endMs: number }) => a.startMs < b.endMs && a.endMs > b.startMs;

/** Segments hors de toute session, quel que soit leur type, puis recollés par type (écart < 10 min). */
export function leftoverGroups<T extends Piece>(segments: T[], sessions: FitSession[]): T[][] {
  return groupPieces(segments.filter((s) => !sessions.some((x) => overlaps(s, x))));
}

/** Activité Google Fit déjà en base : clé d'import, morceaux recollés, période. */
export type Existing = { id: string; dedupeKey: string | null; mergedSourceIds: string[]; startMs: number; endMs: number };
export const isSegmentActivity = (e: Pick<Existing, "dedupeKey">) => !!e.dedupeKey?.startsWith("gfit-seg-");

/**
 * Ce qu'il faut faire d'une session face à la base :
 * - « exists » : l'activité de la session est là (clé gfit-<id> ou id dans mergedSourceIds), rien ne la recouvre ;
 * - « create » : à créer ;
 * - « replace » : des activités nées de segments recouvrent sa période : à reconstruire depuis la session (tools/reconstruire-gfit.ts),
 *   la synchro n'y touche pas (elle ne supprime jamais rien d'elle-même).
 */
export function planSession(s: FitSession, existing: Existing[]): { status: "exists" | "create" | "replace"; ownId: string | null; replaces: string[] } {
  const own = existing.find((e) => e.dedupeKey === `gfit-${s.id}` || e.mergedSourceIds.includes(s.id)) ?? null;
  const replaces = existing.filter((e) => e !== own && isSegmentActivity(e) && overlaps(e, s)).map((e) => e.id);
  return { status: replaces.length ? "replace" : own ? "exists" : "create", ownId: own?.id ?? null, replaces };
}
