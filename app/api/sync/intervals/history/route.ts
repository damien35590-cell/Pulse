import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncIntervalsHistory } from "@/lib/sync/intervals";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
/** On s'arrête de lancer des téléchargements à 40 s : le dernier fichier et la réponse tiennent dans les 60 s. */
const BUDGET_MS = 40_000;

/**
 * Rattrapage de l'historique GPS depuis Intervals.icu, par morceaux.
 * Corps : { before?: ISO } (absent = maintenant). Réponse : statistiques + `next` à renvoyer tant que `done` est faux.
 */
export async function POST(req: Request) {
  const t0 = Date.now();
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const before = b?.before ? new Date(b.before) : new Date(Date.now() + 864e5);
  if (Number.isNaN(+before)) return NextResponse.json({ error: "Date invalide." }, { status: 400 });
  try {
    return NextResponse.json(await syncIntervalsHistory(uid, before, t0 + BUDGET_MS));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "erreur" }, { status: 502 });
  }
}
