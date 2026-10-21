import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { placeAt, searchPlaces } from "@/lib/routes/places";

export const dynamic = "force-dynamic";

const coord = (v: string | null, max: number) => (v != null && v !== "" && Math.abs(Number(v)) <= max ? Number(v) : null);

/**
 * Lieux de départ. ?q=…&lat&lng : recherche (proximité de lat/lng) ; ?lat&lng seul : nom du lieu à ce point.
 * { places: null } si Photon ne répond pas.
 */
export async function GET(req: Request) {
  if (!(await auth())?.user?.id) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  const s = new URL(req.url).searchParams;
  const q = s.get("q")?.trim().slice(0, 120) ?? "", lat = coord(s.get("lat"), 90), lng = coord(s.get("lng"), 180);
  const near = lat != null && lng != null ? { lat, lng } : undefined;
  if (q.length >= 3) return NextResponse.json({ places: await searchPlaces(q, near) });
  if (q) return NextResponse.json({ places: [] });
  if (!near) return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  const p = await placeAt(near.lat, near.lng);
  return NextResponse.json({ places: p ? [p] : null });
}
