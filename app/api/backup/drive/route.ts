import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DriveAuthError, backupToDrive } from "@/lib/backup/drive-backup";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

/** « Sauvegarder maintenant » (Vous › Réglages) : la muscu de la personne connectée vers Google Drive. */
export async function POST() {
  const uid = (await auth())?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await backupToDrive(uid);
    return NextResponse.json({ ok: true, lastBackupAt: new Date().toISOString(), date: r.date, counts: r.counts });
  } catch (e) {
    console.error("[backup] manuel", e instanceof Error ? e.message : e);
    if (e instanceof DriveAuthError) return NextResponse.json({ error: "reconnect", message: "Reconnecte Google (déconnexion puis « Continuer avec Google »)." }, { status: 403 });
    return NextResponse.json({ error: "backup", message: "Sauvegarde impossible. Réessaie plus tard." }, { status: 502 });
  }
}
