import { prisma } from "@/lib/prisma";

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
          providerAccountId: account.providerAccountId 
        } 
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

  // Boucle pour enregistrer chaque séance dans Pulse
  for (const session of sessions) {
    // Calcul de la date et de la durée
    const start = new Date(parseInt(session.startTimeMillis));
    const end = new Date(parseInt(session.endTimeMillis));
    const durationS = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    // Clé unique pour ne pas importer 2 fois la même activité
    const dedupeKey = `gfit-${session.id}`;

    // Vérifier si la séance existe déjà dans ta base
    const existing = await prisma.activity.findFirst({
      where: { userId: uid, dedupeKey: dedupeKey }
    });

    if (existing) {
      duplicates++;
      continue;
    }

    // Création de l'activité dans Prisma
    try {
      await prisma.activity.create({
        data: {
          userId: uid,
          dedupeKey: dedupeKey,
          title: session.name || "Activité Google Fit",
          startedAt: start,
          movingTimeS: durationS,
          distanceM: 0, // À 0 par défaut pour les sessions simples
        }
      });
      saved++;
    } catch (e) {
      console.error("Impossible de sauvegarder la session", session.id, e);
    }
  }

  return { 
    success: true, 
    count: sessions.length, 
    message: `${saved} nouvelle(s) sortie(s) enregistrée(s), ${duplicates} déjà présente(s).`
  };
}