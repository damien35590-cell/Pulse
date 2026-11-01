/**
 * Réglages des notifications : types et valeurs par défaut, sans accès à la base.
 * Séparé de prefs.ts pour qu'un composant client puisse les importer sans entraîner
 * le client Prisma (et donc le pilote pg, réservé au serveur) dans le bundle du navigateur.
 */
export type Prefs = { morning: boolean; reminder: boolean; weekly: boolean };
export type AllPrefs = Prefs & { morningCoachTime: string };
export const DEFAULT_PREFS: Prefs = { morning: true, reminder: true, weekly: true };
export const DEFAULT_MORNING_TIME = "06:00";

/** Heures proposables pour le coach du matin : 5 h 00 … 9 h 00 par pas de 15 min. */
export const MORNING_TIMES = Array.from({ length: 17 }, (_, k) => {
  const m = 5 * 60 + k * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});
