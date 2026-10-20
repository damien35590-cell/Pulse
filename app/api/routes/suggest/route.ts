import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { suggestRoutes } from "@/lib/routes/suggest";
import { RoutingError } from "@/lib/routes/generate";

// ORS (≈ 5 s) + Overpass (jusqu'à 30 s quand la zone n'est pas en cache) + notation : on garde de la marge.
export const maxDuration = 60;
export const dynamic = "force-dynamic";
/** Échéance interne, sous maxDuration : on répond toujours proprement plutôt que de se faire couper. */
const BUDGET_MS = 54_000;

const isCoord = (v: unknown, max: number): v is number => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= max;

/** 3 boucles au départ de `start` pour le temps disponible. Corps : { sport, variant?, minutes, start: { lat, lng } }. */
export async function POST(req: Request) {
  const t0 = Date.now();
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const b = await req.json().catch(() => null);
  const sport = b?.sport, variant = b?.variant, minutes = Math.round(Number(b?.minutes)), start = b?.start;
  if ((sport !== "RUN" && sport !== "RIDE") || (variant != null && variant !== "road" && variant !== "trail"))
    return NextResponse.json({ error: "Sport inconnu." }, { status: 400 });
  if (!(minutes >= 15 && minutes <= 300)) return NextResponse.json({ error: "Durée entre 15 min et 5 h." }, { status: 400 });
  if (!isCoord(start?.lat, 90) || !isCoord(start?.lng, 180)) return NextResponse.json({ error: "Point de départ invalide." }, { status: 400 });

  try {
    const res = await suggestRoutes(uid, { sport, variant: variant ?? undefined, minutes, start: { lat: start.lat, lng: start.lng } }, t0 + BUDGET_MS);
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof RoutingError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[routes/suggest]", e);
    return NextResponse.json({ error: "La recherche a échoué. Réessaie dans un instant." }, { status: 500 });
  }
}
