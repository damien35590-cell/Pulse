"use server";
import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/dates";
import { endOfDay, parsePeriod } from "@/lib/analysis/period";
import { getCoachFacts, type CoachScope } from "@/lib/coach/facts";
import { askCoach, CoachAiError, COACH_MODEL } from "@/lib/coach/ai";
import { DOCTRINE_VERSION } from "@/lib/coach/doctrine";
import { debriefKey, toView, type DebriefView } from "@/lib/coach/store";

const TZ = "Europe/Paris";
/** Garde-fou de coût : générations au plus par jour (toutes périodes et onglets confondus). */
const DAILY_CAP = 20;

export type DebriefResponse = { ok: true; view: DebriefView; cached: boolean } | { ok: false; error: string };

const scopeOf = (s?: string): CoachScope | null => (s === "RUN" || s === "WORKOUT" ? s : !s || s === "all" ? "all" : null);

/** Debrief du coach IA pour l'onglet et la période affichés. Réutilise le dernier si les faits n'ont pas changé (sauf `force`). */
export async function generateDebrief(input: { w?: string; to?: string; s?: string; force?: boolean }): Promise<DebriefResponse> {
  const userId = (await auth())?.user?.id;
  if (!userId) return { ok: false, error: "Session expirée : reconnecte-toi." };
  const scope = scopeOf(input.s);
  if (!scope) return { ok: false, error: "Le coach IA analyse les onglets Tous, Course et Muscu." };

  const period = parsePeriod(input, TZ), periodKey = debriefKey(period.weeks, period.endKey);
  try {
    const facts = await getCoachFacts(userId, scope, period, TZ);
    const factsHash = createHash("sha256").update(`${DOCTRINE_VERSION}|${COACH_MODEL}|${JSON.stringify(facts)}`).digest("hex");
    const existing = await prisma.coachDebrief.findUnique({ where: { userId_scope_periodKey: { userId, scope, periodKey } } });
    if (existing && existing.factsHash === factsHash && !input.force) return { ok: true, cached: true, view: toView(existing) };

    const today = dayKey(new Date(), TZ), dayStart = new Date(+endOfDay(today, TZ) - 864e5 + 1000);
    if ((await prisma.coachDebrief.count({ where: { userId, updatedAt: { gte: dayStart } } })) >= DAILY_CAP) {
      return { ok: false, error: `Limite de ${DAILY_CAP} analyses par jour atteinte : reviens demain.` };
    }

    const r = await askCoach(facts);
    const data = { factsHash, data: r.debrief as unknown as Prisma.InputJsonValue, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, cachedTokens: r.cachedTokens };
    const row = await prisma.coachDebrief.upsert({ where: { userId_scope_periodKey: { userId, scope, periodKey } }, create: { userId, scope, periodKey, ...data }, update: data });
    return { ok: true, cached: false, view: toView(row) };
  } catch (e) {
    console.error("[coach-ia]", e);
    return { ok: false, error: e instanceof CoachAiError ? e.message : "Analyse impossible pour le moment, réessaie dans un instant." };
  }
}
