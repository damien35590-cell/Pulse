"use server";
import { auth } from "@/lib/auth";
import { deleteTemplate, draftExercise, getStartOptions, saveSessionAsTemplate } from "@/lib/workout/queries";
import type { DraftExercise, StartOptions } from "@/lib/workout/types";

async function userId() {
  const id = (await auth())?.user?.id;
  if (!id) throw new Error("Session expirée : reconnecte-toi.");
  return id;
}

/** Contenu de la feuille « Nouvelle séance » : suggestion, dernières séances, modèles. */
export async function startOptions(): Promise<StartOptions> {
  return getStartOptions(await userId());
}

export async function removeTemplate(id: string): Promise<boolean> {
  return deleteTemplate(id, await userId());
}

export async function saveTemplate(sessionId: string, name: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const t = await saveSessionAsTemplate(sessionId, await userId(), name).catch(() => null);
  return t ? { ok: true, name: t.name } : { ok: false, error: "Impossible d'enregistrer le modèle : réessaie." };
}

/** Un exercice à ajouter à la séance en préparation, avec sa cible du jour. */
export async function exerciseForDraft(name: string): Promise<DraftExercise | null> {
  return draftExercise(await userId(), name.slice(0, 80));
}
