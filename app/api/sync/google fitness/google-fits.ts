import { prisma } from "@/lib/prisma";

export async function syncGoogleFit(uid: string, days: number = 7) {
  // 1. Récupérer le token Google dans ta base de données Neon
  const account = await prisma.account.findFirst({
    where: { userId: uid, provider: "google" },
  });

  if (!account || !account.access_token) {
    throw new Error("Compte Google non lié ou token d'accès manquant");
  }

  // 2. Définir la période de recherche (ex: les 7 derniers jours)
  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(endTime.getDate() - days);

  // 3. Appeler l'API Google Fit
  const res = await fetch(
    `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startTime.toISOString()}&endTime=${endTime.toISOString()}`,
    {
      headers: { Authorization: `Bearer ${account.access_token}` },
    }
  );

  if (!res.ok) {
    throw new Error("Erreur de communication avec l'API Google Fit");
  }

  const data = await res.json();
  const sessions = data.session || [];

  // Pour l'instant, on renvoie simplement les données brutes sans les écrire dans la base
  // Cela permettra de vérifier que la connexion fonctionne et de voir le format des données
  return { 
    success: true, 
    count: sessions.length, 
    message: `Trouvé ${sessions.length} séances sur Google Fit.`,
    sessions: sessions 
  };
}