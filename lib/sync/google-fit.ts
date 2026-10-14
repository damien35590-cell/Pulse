import { prisma } from "@/lib/prisma";

// Traduit les codes d'activité Google Fit vers ton ActivityType Prisma
function mapFitType(typeId: number) {
  switch (typeId) {
    case 8: return "RUN";      // Course à pied
    case 1:
    case 17: return "RIDE";    // Vélo classique, Spinning/Home trainer
    case 7: return "WALK";     // Marche
    case 76: return "SWIM";    // Natation
    case 97:                   // Musculation/Haltérophilie
    case 11:                   // Crossfit
    case 9: return "WORKOUT";  // Fitness/Aerobics
    default: return "OTHER";   // Autre sport par défaut
  }
}

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

// Récupère la distance (en mètres) parcourue pendant une séance
async function fetchSessionDistanceM(
  token: string,
  startMs: number,
  endMs: number
): Promise<number | null> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      {
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
      }
    );

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

  for (const session of sessions) {
    // 1. Sécurité : si la date de départ n'existe pas, on ignore
    if (!session.startTimeMillis) continue;

    const start = new Date(parseInt(session.startTimeMillis));
    let durationS = 0;

    // 2. Sécurité : calcul de la durée seulement si la séance est terminée
    if (session.endTimeMillis) {
      durationS = Math.floor(
        (parseInt(session.endTimeMillis) - start.getTime()) / 1000
      );
    }

    const dedupeKey = `gfit-${session.id}`;

    // Distance réelle de la séance (null si indisponible)
    const endMs = session.endTimeMillis ? parseInt(session.endTimeMillis) : null;
    const distanceM = endMs
      ? await fetchSessionDistanceM(validToken, start.getTime(), endMs)
      : null;

    const existing = await prisma.activity.findFirst({
      where: { userId: uid, dedupeKey: dedupeKey },
    });

    if (existing) {
      // Les anciennes activités à 0 m récupèrent leur vraie distance
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

    try {
      await prisma.activity.create({
        data: {
          userId: uid,
          dedupeKey: dedupeKey,
          externalId: session.id || dedupeKey,
          source: "fit",
          title: session.name || `Activité ${typeEnum}`,
          type: typeEnum as any,
          startedAt: start,
          movingTimeS: durationS > 0 ? durationS : 0,
          distanceM: distanceM ?? 0,
        },
      });
      saved++;
    } catch (e: any) {
      throw new Error(`Erreur Prisma : ${e.message || String(e)}`);
    }
  }

  return {
    success: true,
    count: sessions.length,
    message: `${saved} nouvelle(s) sortie(s), ${updated} distance(s) mise(s) à jour, ${duplicates} déjà présente(s).`,
  };
}