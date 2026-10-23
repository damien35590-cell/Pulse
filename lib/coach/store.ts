/** Lecture des debriefs du coach IA enregistrés (table CoachDebrief). Côté serveur uniquement. */
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import type { Debrief } from "./ai";
import type { CoachScope } from "./facts";

export type DebriefView = { debrief: Debrief; at: string; model: string };
export const debriefKey = (weeks: number, endKey: string) => `${weeks}:${endKey}`;

export function toView(row: { data: Prisma.JsonValue; updatedAt: Date; model: string }): DebriefView {
  return { debrief: row.data as unknown as Debrief, at: row.updatedAt.toISOString(), model: row.model };
}

/** Dernier debrief enregistré pour cet onglet et cette période (affiché sans nouvel appel), ou null. */
export async function lastDebrief(userId: string, scope: CoachScope, weeks: number, endKey: string): Promise<DebriefView | null> {
  const row = await prisma.coachDebrief.findUnique({ where: { userId_scope_periodKey: { userId, scope, periodKey: debriefKey(weeks, endKey) } } });
  return row ? toView(row) : null;
}
