/** Écritures de la bibliothèque : « Ajouter à mes modèles », « Dupliquer », « Mon matériel ». Filtre toujours sur l'utilisateur. */
import { prisma } from "../prisma";
import { equipmentOf } from "./catalog";
import type { Equipment } from "./catalog-data";
import { kindOfNames } from "./kind";
import { displayName } from "./catalog";
import { libraryTemplate, templateStructures } from "./library";
import type { Structure } from "./draft";

/** Un nom libre parmi les modèles de l'utilisateur : « Lafay · Niveau 2 », sinon « … (2) ». */
async function freeName(userId: string, wanted: string): Promise<string> {
  const taken = new Set((await prisma.workoutTemplate.findMany({ where: { userId, name: { startsWith: wanted.slice(0, 50) } }, select: { name: true } })).map((t) => t.name));
  let name = wanted;
  for (let n = 2; taken.has(name); n++) name = `${wanted.slice(0, 54)} (${n})`;
  return name;
}

const rows = (structure: Structure[]) => structure.map((s, order) => ({
  order, exerciseCode: s.code, variant: s.variant, sets: s.sets, targetReps: s.reps, restSec: s.restSec, restAfterSec: s.restAfterSec, loadKg: s.loadKg, note: s.note,
}));

/** Crée un modèle de séance par séance du modèle de la bibliothèque. Renvoie les noms créés, ou null si le modèle est inconnu. */
export async function installLibraryTemplate(userId: string, templateId: string): Promise<string[] | null> {
  const t = libraryTemplate(templateId);
  if (!t) return null;
  const created: string[] = [];
  for (const s of templateStructures(t)) {
    const name = await freeName(userId, s.name);
    await prisma.workoutTemplate.create({
      data: { userId, name, kind: kindOfNames(s.structure.map((x) => displayName(x.code, x.variant))), isBuiltIn: false, exercises: { create: rows(s.structure) } },
    });
    created.push(name);
  }
  return created;
}

/** Copie modifiable d'un modèle (intégré ou perso) : « Haut du corps (2) ». */
export async function duplicateTemplate(userId: string, templateId: string): Promise<string | null> {
  const t = await prisma.workoutTemplate.findFirst({ where: { id: templateId, userId }, include: { exercises: { orderBy: { order: "asc" } } } });
  if (!t) return null;
  const name = await freeName(userId, t.name);
  await prisma.workoutTemplate.create({
    data: {
      userId, name, kind: t.kind, isBuiltIn: false,
      exercises: { create: t.exercises.map(({ order, exerciseCode, variant, sets, targetReps, restSec, restAfterSec, loadKg, note }) => ({ order, exerciseCode, variant, sets, targetReps, restSec, restAfterSec, loadKg, note })) },
    },
  });
  return name;
}

export async function getEquipment(userId: string): Promise<Equipment[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { homeEquipment: true } });
  return equipmentOf(u?.homeEquipment);
}

export async function setEquipment(userId: string, list: string[]): Promise<Equipment[]> {
  const clean = equipmentOf(list.slice(0, 20));
  await prisma.user.update({ where: { id: userId }, data: { homeEquipment: clean } });
  return clean;
}
