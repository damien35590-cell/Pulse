"use server";
import { auth } from "@/lib/auth";
import { deleteTemplate, draftExercise, getStartOptions, saveSessionAsTemplate } from "@/lib/workout/queries";
import type { DraftExercise, StartOptions } from "@/lib/workout/types";
import { revalidatePath } from "next/cache";
import { duplicateTemplate, getEquipment, installLibraryTemplate, setEquipment } from "@/lib/workout/library-db";
import type { Equipment } from "@/lib/workout/catalog-data";

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

/** « Mon matériel » : filtre du catalogue et des modèles. */
export async function myEquipment(): Promise<Equipment[]> {
  return getEquipment(await userId());
}

export async function saveEquipment(list: string[]): Promise<Equipment[]> {
  const saved = await setEquipment(await userId(), list);
  revalidatePath("/profile/settings");
  return saved;
}

/** Bibliothèque : crée les modèles de séance d'un modèle (Lafay, SuperPhysique, perso). */
export async function addLibraryTemplate(id: string): Promise<{ ok: true; names: string[] } | { ok: false; error: string }> {
  const names = await installLibraryTemplate(await userId(), id).catch(() => null);
  return names?.length ? { ok: true, names } : { ok: false, error: "Impossible d'ajouter ce modèle : réessaie." };
}

export async function copyTemplate(id: string): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  const name = await duplicateTemplate(await userId(), id).catch(() => null);
  return name ? { ok: true, name } : { ok: false, error: "Impossible de dupliquer ce modèle : réessaie." };
}
