import type { ActivityType } from "@prisma/client";
import { SPORT_LABEL } from "@/lib/sports";
import { prisma } from "@/lib/prisma";
import { findOverlapping, processActivity } from "@/lib/pipeline/post-import";

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
async function getValidAccessToken(account: any) {
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
        bucketByActivitySegment: { minDurationMillis: 5 * 60 * 1000 },
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
  const sessions = data.session || [];

  let saved = 0;
  let duplicates = 0;
  let updated = 0;
  let auto = 0;
  const sessionRanges: { startMs: number; endMs: number }[] = [];

  // ---------- 1. Séances enregistrées (méthode d'origine) ----------
  for (const session of sessions) {
    if (!session.startTimeMillis) continue;

    const start = new Date(parseInt(session.startTimeMillis));
    let durationS = 0;

    if (session.endTimeMillis) {
      durationS = Math.floor(
        (parseInt(session.endTimeMillis) - start.getTime()) / 1000
      );
    }

    const dedupeKey = `gfit-${session.id}`;

    const endMs = session.endTimeMillis ? parseInt(session.endTimeMillis) : null;
    if (endMs) sessionRanges.push({ startMs: start.getTime(), endMs });

    const distanceM = endMs
      ? await fetchSessionDistanceM(validToken, start.getTime(), endMs)
      : null;

    const existing = await prisma.activity.findFirst({
      where: { userId: uid, dedupeKey: dedupeKey },
    });

    if (existing) {
      if (distanceM && existing.distanceM === 0) {
        await prisma.activity.update({
          where: { id: existing.id },
          data: { distanceM },
        });
        updated++;
      }
      duplicates++;
      continue;
    }

    const typeEnum = mapFitType(session.activityType);

    // Même sortie déjà enregistrée par une autre source (FIT, saisie…) : Google Fit n'apporte rien de plus.
    if ((await findOverlapping(uid, { startedAt: start, movingTimeS: Math.max(durationS, 0) })).length) {
      duplicates++;
      continue;
    }

    let id: string;
    try {
      ({ id } = await prisma.activity.create({
        data: {
          userId: uid,
          dedupeKey: dedupeKey,
          externalId: session.id || dedupeKey,
          source: GOOGLE_FIT_SOURCE,
          title: session.name || AUTO_TITLES[typeEnum] || `Activité ${typeEnum}`,
          type: typeEnum,
          startedAt: start,
          movingTimeS: durationS > 0 ? durationS : 0,
          distanceM: distanceM ?? 0,
        },
        select: { id: true },
      }));
      saved++;
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
    await processActivity(id);
  }

  // ---------- 2. Activités détectées automatiquement ----------
  const segments = await fetchActivitySegments(
    validToken,
    startTime.getTime(),
    endTime.getTime()
  );

  const TOLERANCE_MS = 5 * 60 * 1000;

  for (const seg of segments) {
    // Déjà couvert par une séance enregistrée ? On ignore.
    const overlaps = sessionRanges.some(
      (r) => seg.startMs < r.endMs && seg.endMs > r.startMs
    );
    if (overlaps) continue;

    const typeEnum = mapFitType(seg.activity);

    // Les bornes d'un segment peuvent bouger de quelques secondes :
    // on cherche donc une activité du même type qui démarre à ±5 min.
    const existing = await prisma.activity.findFirst({
      where: {
        userId: uid,
        dedupeKey: { startsWith: "gfit-" },
        // Les vélos déjà en base peuvent encore être en RIDE (avant reclassement en EBIKE).
        type: { in: typeEnum === "EBIKE" ? ["EBIKE", "RIDE"] : [typeEnum] },
        startedAt: {
          gte: new Date(seg.startMs - TOLERANCE_MS),
          lte: new Date(seg.startMs + TOLERANCE_MS),
        },
      },
    });

    if (existing) {
      if (existing.distanceM === 0) {
        const d = await fetchSessionDistanceM(validToken, seg.startMs, seg.endMs);
        if (d) {
          await prisma.activity.update({
            where: { id: existing.id },
            data: { distanceM: d },
          });
          updated++;
        }
      }
      duplicates++;
      continue;
    }

    const dedupeKey = `gfit-seg-${seg.activity}-${seg.startMs}`;
    const durationS = Math.floor((seg.endMs - seg.startMs) / 1000);

    // Même sortie déjà enregistrée par une autre source : on n'ajoute pas la version Google Fit, plus pauvre.
    if ((await findOverlapping(uid, { startedAt: new Date(seg.startMs), movingTimeS: Math.max(durationS, 0) })).length) {
      duplicates++;
      continue;
    }

    const distanceM = await fetchSessionDistanceM(
      validToken,
      seg.startMs,
      seg.endMs
    );

    let id: string;
    try {
      ({ id } = await prisma.activity.create({
        data: {
          userId: uid,
          dedupeKey: dedupeKey,
          externalId: dedupeKey,
          source: GOOGLE_FIT_SOURCE,
          title: AUTO_TITLES[typeEnum] || `Activité ${typeEnum}`,
          type: typeEnum,
          startedAt: new Date(seg.startMs),
          movingTimeS: durationS > 0 ? durationS : 0,
          distanceM: distanceM ?? 0,
        },
        select: { id: true },
      }));
      auto++;
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
    await processActivity(id);
  }

  return {
    success: true,
    count: sessions.length + segments.length,
    message: `${saved} séance(s), ${auto} activité(s) automatique(s), ${updated} distance(s) mise(s) à jour, ${duplicates} déjà présente(s).`,
  };
}