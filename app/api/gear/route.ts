import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGear } from "@/lib/data/gear";

/** Matériel actif pour la liste déroulante de « Nouvelle sortie », avec son niveau d'usure (composants compris). */
export async function GET() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const gear = (await getGear(uid)).filter((g) => !g.retiredAt);
  return NextResponse.json(gear.map((g) => ({ id: g.id, name: g.name, kind: g.kind, sports: g.sports, isDefault: g.isDefault, parentId: g.parentId, retiredAt: null, km: Math.round(g.km), limitKm: g.limitKm, level: g.level })));
}
