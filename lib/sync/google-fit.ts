import type { ActivityType } from "@prisma/client";
import { SPORT_LABEL } from "@/lib/sports";
import { prisma } from "@/lib/prisma";
import { findOverlapping, processActivity } from "@/lib/pipeline/post-import";
import { groupPieces, mergedSpan, type Piece } from "@/lib/sync/google-fit-merge";

/** Source des activités créées par cette synchro (les plus anciennes portent « fit » ; on les reconnaît à leur dedupeKey « gfit-… »). */
export const GOOGLE_FIT_SOURCE = "google-fit";

const AGGREGATE_URL =
  "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate";

// Traduit les codes d'activité Google Fit vers ton ActivityType Prisma
function mapFitType(typeId: number): ActivityType {
  switch (typeId) {
    case 8: return "RUN";      // Course à pied
    case 1:
    case 17: return "EBIKE";   // Vélo : sur Google Fit, ce sont les vélotafs à assistance électrique
    case 7: return "WALK";     // Marche
    case 76: return "SWIM";    // Natation
    case 97:                   // Musculation/Haltérophilie
    case 11:                   // Crossfit
    case 9: return "WORKOUT";  // Fitness/Aerobics
    default: return "OTHER";   // Autre sport par défaut
  }
}

// Activités détectées automatiquement qu'on importe : vélo (vélotaf), marche, course
const AUTO_TYPES = new Set([1, 7, 8]);
const AUTO_TITLES: Record<string, string> = {
  EBIKE: "Vélotaf",
  WALK: SPORT_LABEL("WALK"),
  RUN: SPORT_LABEL("RUN"),
};

// Fonction pour rafraîchir le jeton Google s'il est expiré
export async function getValidAccessToken(account: any) {
  if (!account.refresh_token) return account.access_token;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token,
      }),
    });

    const tokens = await response.json();
    if (!response.ok) throw tokens;

    await prisma.account.update({
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: account.providerAccountId,
        },
      },
      data: {
        access_token: tokens.access_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
      },
    });

    return tokens.access_token;
  } catch (error) {
    console.error("Erreur de rafraîchissement du token :", error);
    return account.access_token;
  }
}

// Récupère la distance (en mètres) sur une période (null si indisponible)
async function fetchSessionDistanceM(
  token: string,
  startMs: number,
  endMs: number
): Promise<number | null> {
  try {
    const res = await fetch(AGGREGATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.distance.delta" }],
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });

    if (!res.ok) {
      console.warn(
        `[google-fit] distance ${res.status}: ${(await res.text()).substring(0, 120)}`
      );
      return null;
    }

    const data = await res.json();
    let total = 0;
    for (const bucket of data.bucket ?? []) {
      for (const ds of bucket.dataset ?? []) {
        for (const point of ds.point ?? []) {
          total += point.value?.[0]?.fpVal ?? 0;
        }
      }
    }
    return Math.round(total);
  } catch (e) {
    console.warn("[google-fit] distance: erreur", e);
    return null;
  }
}

// Récupère les activités détectées automatiquement (vélo, marche, course)
async function fetchActivitySegments(
  token: string,
  startMs: number,
  endMs: number
): Promise<{ activity: number; startMs: number; endMs: number }[]> {
  try {
    const res = await fetch(AGGREGATE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName: "com.google.activity.segment" }],
        bucketByActivitySegment: { minDurationMillis: 60 * 1000 }, // 1 min : les morceaux courts sont recollés, puis seuil de 5 min (MIN_AUTO_S)
        startTimeMillis: startMs,
        endTimeMillis: endMs,
      }),
    });

    if (!res.ok) {
      console.warn(
        `[google-fit] segments ${res.status}: ${(await res.text()).substring(0, 120)}`
      );
      return [];
    }

    const data = await res.json();
    return (data.bucket ?? [])
      .filter((b: any) => AUTO_TYPES.has(b.activity))
      .map((b: any) => ({
        activity: b.activity as number,
        startMs: Number(b.startTimeMillis),
        endMs: Number(b.endTimeMillis),
      }));
  } catch (e) {
    console.warn("[google-fit] segments: erreur", e);
    return [];
  }
}

/** Durée minimale d'une sortie détectée automatiquement, une fois ses morceaux recollés. */
const MIN_AUTO_S = 5 * 60;
const TOLERANCE_MS = 5 * 60 * 1000;

type Sourced = Piece & { id: string };

/** Distance d'une sortie recollée : somme des morceaux (null si Google n'en donne pour aucun). */
async function piecesDistanceM(token: string, g: Piece[]): Promise<number | null> {
  const parts = await Promise.all(g.map((p) => fetchSessionDistanceM(token, p.startMs, p.endMs)));
  return parts.some((d) => d != null) ? parts.reduce<number>((s, d) => s + (d ?? 0), 0) : null;
}

/**
 * Activités Google Fit déjà en base pour une sortie : par id (dedupeKey, mergedSourceIds) ou du même type démarrant dans la sortie.
 * Aucune → à créer. Une seule → mise à jour si elle ne couvre pas encore tous les morceaux (sortie importée avant la fusion,
 * ou encore en cours à la synchro précédente). Plusieurs → morceaux importés séparément avant cette règle : on n'y touche pas
 * ici (rattrapage : tools/fusionner-gfit.ts).
 */
async function existingFor(uid: string, types: ActivityType[], ids: string[], span: { startMs: number; endMs: number }) {
  return prisma.activity.findMany({
    where: {
      userId: uid,
      OR: [
        { dedupeKey: { in: ids.map((i) => `gfit-${i}`) } },
        { mergedSourceIds: { hasSome: ids } },
        { dedupeKey: { startsWith: "gfit-" }, type: { in: types }, startedAt: { gte: new Date(span.startMs - TOLERANCE_MS), lte: new Date(span.endMs) } },
      ],
    },
    select: { id: true, dedupeKey: true, mergedSourceIds: true, distanceM: true },
  });
}

export async function syncGoogleFit(uid: string, days: number = 7) {
  const account = await prisma.account.findFirst({
    where: { userId: uid, provider: "google" },
  });

  if (!account || !account.access_token) {
    throw new Error("Compte Google non lié.");
  }

  const validToken = await getValidAccessToken(account);

  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(endTime.getDate() - days);

  const res = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`,
    {
      headers: { Authorization: `Bearer ${validToken}` },
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google (${res.status}) : ${errorText.substring(0, 80)}`);
  }

  const data = await res.json();
  const sessions = (data.session || []).filter((s: any) => s.startTimeMillis && s.id);

  let saved = 0;
  let duplicates = 0;
  let updated = 0;
  let auto = 0;
  let joined = 0;
  const sessionRanges: { startMs: number; endMs: number }[] = [];

  /**
   * Importe (ou complète) une sortie faite d'un ou plusieurs morceaux consécutifs de même type.
   * dedupeKey = « gfit-<id du premier morceau> » : la même clé qu'avant la fusion pour une sortie d'un seul morceau.
   */
  async function upsert(g: Sourced[], typeEnum: ActivityType, title: string): Promise<"created" | "updated" | "same"> {
    const ids = g.map((p) => p.id), span = mergedSpan(g), merged = g.length > 1;
    const types: ActivityType[] = typeEnum === "EBIKE" ? ["EBIKE", "RIDE"] : [typeEnum];
    const found = await existingFor(uid, types, ids, span);
    if (found.length > 1) return "same";
    if (found.length === 1) {
      const e = found[0], has = new Set([...e.mergedSourceIds, e.dedupeKey?.replace(/^gfit-/, "")]);
      if (ids.every((i) => has.has(i))) {
        if (e.distanceM === 0) {
          const d = await piecesDistanceM(validToken, g);
          if (d) { await prisma.activity.update({ where: { id: e.id }, data: { distanceM: d } }); return "updated"; }
        }
        return "same";
      }
      // La sortie a grandi (ou n'avait été prise qu'en partie) : on la complète, sans toucher à ce que tu as saisi dessus.
      const d = await piecesDistanceM(validToken, g);
      await prisma.activity.update({
        where: { id: e.id },
        data: {
          startedAt: new Date(span.startMs), movingTimeS: span.movingS, elapsedTimeS: merged ? span.elapsedS : null,
          ...(d != null ? { distanceM: d } : {}), mergedSourceIds: merged ? ids : [],
        },
      });
      await processActivity(e.id);
      if (merged) joined += g.length - 1;
      return "updated";
    }

    // Même sortie déjà enregistrée par une autre source (FIT, saisie…) : Google Fit n'apporte rien de plus.
    if ((await findOverlapping(uid, { startedAt: new Date(span.startMs), movingTimeS: span.movingS, elapsedTimeS: span.elapsedS })).length) return "same";

    const distanceM = await piecesDistanceM(validToken, g);
    const dedupeKey = `gfit-${g[0].id}`;
    let id: string;
    try {
      ({ id } = await prisma.activity.create({
        data: {
          userId: uid,
          dedupeKey,
          externalId: dedupeKey,
          source: GOOGLE_FIT_SOURCE,
          title,
          type: typeEnum,
          startedAt: new Date(span.startMs),
          movingTimeS: span.movingS,
          ...(merged ? { elapsedTimeS: span.elapsedS, mergedSourceIds: ids } : {}),
          distanceM: distanceM ?? 0,
        },
        select: { id: true },
      }));
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
    if (merged) joined += g.length - 1;
    await processActivity(id);
    return "created";
  }

  // ---------- 1. Séances enregistrées : les morceaux d'une même sortie (pauses) sont recollés ----------
  const sessionPieces: (Sourced & { s: any })[] = sessions.map((s: any) => {
    const startMs = parseInt(s.startTimeMillis);
    return { s, id: String(s.id), type: s.activityType, startMs, endMs: s.endTimeMillis ? parseInt(s.endTimeMillis) : startMs };
  });
  for (const g of groupPieces(sessionPieces)) {
    const span = mergedSpan(g);
    if (span.endMs > span.startMs) sessionRanges.push({ startMs: span.startMs, endMs: span.endMs });
    const typeEnum = mapFitType(g[0].s.activityType);
    const r = await upsert(g, typeEnum, g[0].s.name || AUTO_TITLES[typeEnum] || `Activité ${typeEnum}`);
    if (r === "created") saved++; else if (r === "updated") updated++; else duplicates++;
  }

  // ---------- 2. Activités détectées automatiquement : idem, segments recollés ----------
  const segments = await fetchActivitySegments(
    validToken,
    startTime.getTime(),
    endTime.getTime()
  );

  for (const g of groupPieces(segments.map((s) => ({ ...s, type: s.activity, id: `seg-${s.activity}-${s.startMs}` })))) {
    const span = mergedSpan(g);
    // Déjà couvert par une séance enregistrée ? On ignore.
    if (sessionRanges.some((r) => span.startMs < r.endMs && span.endMs > r.startMs)) continue;
    // Les petits bouts isolés restent ignorés ; recollés, ils comptent.
    if (span.movingS < MIN_AUTO_S) continue;
    const typeEnum = mapFitType(g[0].activity);
    const r = await upsert(g, typeEnum, AUTO_TITLES[typeEnum] || `Activité ${typeEnum}`);
    if (r === "created") auto++; else if (r === "updated") updated++; else duplicates++;
  }

  return {
    success: true,
    count: sessions.length + segments.length,
    saved: saved + auto, // activités créées (séances + automatiques)
    message: `${saved} séance(s), ${auto} activité(s) automatique(s), ${updated} mise(s) à jour, ${duplicates} déjà présente(s)${joined ? `, ${joined} morceau(x) recollé(s)` : ""}.`,
  };
}
