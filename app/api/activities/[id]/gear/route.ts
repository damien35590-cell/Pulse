import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ownGearIds } from "@/lib/data/gear";

/** Remplace le matériel affecté à une sortie (corrige une affectation automatique, ajoute le home trainer…). */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const a = await prisma.activity.findFirst({ where: { id: params.id, userId: uid }, select: { id: true, gear: { select: { id: true } } } });
  if (!a) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const b = await req.json().catch(() => null);
  const ids = await ownGearIds(uid, b?.gearIds);
  // Le matériel déjà retiré reste attaché : on ne réécrit pas l'historique d'une ancienne paire.
  const retired = await prisma.gear.findMany({ where: { id: { in: a.gear.map((g) => g.id) }, retiredAt: { not: null } }, select: { id: true } });
  await prisma.activity.update({ where: { id: a.id }, data: { gear: { set: [...ids, ...retired.map((r) => r.id)].map((id) => ({ id })) } } });
  revalidatePath("/gear"); revalidatePath("/");
  return NextResponse.json({ gearIds: ids });
}
