/** Modèles intégrés « Haut du corps » et « Bas + abdos » (les mêmes séances que le coach du jour, lib/coach/today.ts), créés pour chaque utilisateur. */
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { DEFAULT_REPS, DEFAULT_SETS, REST_AFTER_S, REST_BETWEEN_S, defaultVariant } from "./catalog";
import { applyLafayProgress } from "./lafay";
import { loadHistory, latestKeyOf } from "./history";
import type { Structure } from "./draft";
import type { Kind } from "./types";

export const BUILT_IN: readonly { name: string; kind: Exclude<Kind, "LIBRE">; codes: readonly string[] }[] = [
  { name: "Haut du corps", kind: "HAUT", codes: ["B", "A", "C"] },
  { name: "Bas + abdos", kind: "BAS", codes: ["F", "G", "H"] },
];

/**
 * Variante et reps de départ : la cible du jour d'après ton historique, sinon le premier niveau de l'échelle.
 * (Les programmes ne portent pas de séances Lafay exploitables : aucun code ne crée leurs créneaux.)
 */
export function builtInStructure(codes: readonly string[], history: Awaited<ReturnType<typeof loadHistory>>): Structure[] {
  return codes.map((code) => {
    const p = applyLafayProgress(history.get(latestKeyOf(code, history)) ?? []);
    return { code, variant: p ? p.variant : defaultVariant(code), sets: DEFAULT_SETS, reps: p?.reps ?? DEFAULT_REPS, restSec: REST_BETWEEN_S, restAfterSec: REST_AFTER_S, loadKg: null, note: null };
  });
}

/** Crée les modèles intégrés qui manquent ; sans effet s'ils existent déjà (appelable à chaque ouverture). */
export async function ensureBuiltInTemplates(userId: string): Promise<void> {
  const have = new Set((await prisma.workoutTemplate.findMany({ where: { userId, isBuiltIn: true }, select: { kind: true } })).map((t) => t.kind));
  const missing = BUILT_IN.filter((b) => !have.has(b.kind));
  if (!missing.length) return;
  const history = await loadHistory(userId);
  for (const b of missing) {
    try {
      await prisma.workoutTemplate.create({
        data: {
          userId, name: b.name, kind: b.kind, isBuiltIn: true,
          exercises: { create: builtInStructure(b.codes, history).map((s, order) => ({ order, exerciseCode: s.code, variant: s.variant, sets: s.sets, targetReps: s.reps, restSec: s.restSec, restAfterSec: s.restAfterSec, loadKg: s.loadKg, note: s.note })) },
        },
      });
    } catch (e) {
      // Créé en parallèle, ou un modèle perso porte déjà ce nom : on laisse tel quel.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
}
