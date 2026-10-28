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
