import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPoiDetails, parsePoiId } from "@/lib/routes/poi-details";

export const maxDuration = 20;

/** Fiche d'un point d'intérêt OpenStreetMap (id : n123, w45, r6). { details: null } si OSM ne répond pas. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await auth())?.user?.id) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  if (!parsePoiId(params.id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  return NextResponse.json({ details: await getPoiDetails(params.id) });
}
