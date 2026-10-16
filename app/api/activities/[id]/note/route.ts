import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const FEEL_MAP: Record<number, string> = {
  1: "GREAT",
  2: "GOOD",
  3: "OK",
  4: "TIRED",
  5: "HARD",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    let { feeling, feel, notes, comment } = body;

    // Convertit le chiffre du composant (1-5) vers l'Enum Prisma
    if (feel !== undefined) {
      feeling = feel !== null ? FEEL_MAP[feel] : null;
    }

    // Associe le champ comment du composant vers notes de la base
    const finalNotes = comment !== undefined ? comment : notes;

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        feeling: feeling !== undefined ? (feeling as any) : undefined,
        notes: finalNotes !== undefined ? String(finalNotes) : undefined,
      },
      select: { 
        id: true, 
        feeling: true, 
        notes: true 
      },
    });

    return NextResponse.json(activity);

  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'activité:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}