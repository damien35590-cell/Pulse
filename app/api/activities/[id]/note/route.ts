import { NextResponse } from "next/server";
import type { ActivityType, Feeling } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshLoad } from "@/lib/data/load";

const FEEL_MAP: Record<number, Feeling> = {
  1: "GREAT",
  2: "GOOD",
  3: "OK",
  4: "TIRED",
  5: "HARD",
};

// Seul reclassement autorisé : vélo musculaire ↔ E-bike.
const BIKE_TYPES: ActivityType[] = ["RIDE", "EBIKE"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    let { feeling, feel, notes, comment, type, rpe, title } = body;
    // Renommage : texte non vide, 120 caractères au plus.
    if (title !== undefined) {
      title = typeof title === "string" ? title.trim().slice(0, 120) : "";
      if (!title) return NextResponse.json({ error: "invalid_title" }, { status: 400 });
    }

    const current = await prisma.activity.findFirst({ where: { id, userId: uid }, select: { type: true } });
    if (!current) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (type !== undefined && !(BIKE_TYPES.includes(type) && BIKE_TYPES.includes(current.type)))
      return NextResponse.json({ error: "invalid_type" }, { status: 400 });
    // Effort ressenti : entier de 1 à 10, ou null pour l'effacer.
    if (rpe !== undefined && rpe !== null && !(Number.isInteger(rpe) && rpe >= 1 && rpe <= 10))
      return NextResponse.json({ error: "invalid_rpe" }, { status: 400 });

    // Convertit le chiffre du composant (1-5) vers l'Enum Prisma
    if (feel !== undefined) {
      feeling = feel !== null ? FEEL_MAP[feel] : null;
    }

    // Associe le champ comment du composant vers notes de la base
    const finalNotes = comment !== undefined ? comment : notes;

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        type: type as ActivityType | undefined,
        title: title as string | undefined,
        feeling: feeling !== undefined ? (feeling as Feeling | null) : undefined,
        rpe: rpe as number | null | undefined,
        notes: finalNotes !== undefined ? (finalNotes === null ? null : String(finalNotes)) : undefined,
      },
      select: {
        id: true,
        type: true,
        title: true,
        feeling: true,
        notes: true,
        rpe: true,
      },
    });

    // Le ressenti et le reclassement vélo ↔ E-bike changent la charge d'entraînement.
    const load = rpe !== undefined || type !== undefined ? await refreshLoad(id) : null;

    return NextResponse.json({ ...activity, ...load });

  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'activité:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
