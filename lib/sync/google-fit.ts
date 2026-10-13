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

  // MODIFICATION ICI : Récupération du message d'erreur exact
  if (!res.ok) {
    const errorText = await res.text();
    console.error("Détail de l'erreur Google :", errorText);
    throw new Error(`Google (${res.status}) : ${errorText.substring(0, 80)}`);
  }

  const data = await res.json();
  const sessions = data.session || [];

  // Pour l'instant, on renvoie simplement les données brutes sans les écrire dans la base
  return { 
    success: true, 
    count: sessions.length, 
    message: `Trouvé ${sessions.length} séances sur Google Fit.`,
    sessions: sessions 
  };
}