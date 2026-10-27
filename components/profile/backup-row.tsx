"use client";
import { useState } from "react";
import { CloudUpload, Loader2 } from "lucide-react";
import { SettingsRow } from "@/components/ui/settings-row";

const fmt = (iso: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Ligne « Sauvegarder maintenant » : envoie la muscu vers Google Drive et affiche la date de la dernière sauvegarde réussie. */
export function BackupRow({ lastBackupAt }: { lastBackupAt: string | null }) {
  const [last, setLast] = useState(lastBackupAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/backup/drive", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setLast(j.lastBackupAt);
      else setError(j.message ?? "Sauvegarde impossible.");
    } catch { setError("Pas de réseau : réessaie."); }
    setBusy(false);
  }

  const value = busy ? "Sauvegarde en cours…" : error ? <span className="text-bad">{error}</span> : last ? `Dernière sauvegarde : ${fmt(last)}` : "Muscu vers Google Drive · jamais sauvegardé";
  return <SettingsRow icon={busy ? <Loader2 className="animate-spin" aria-hidden /> : <CloudUpload aria-hidden />} title="Sauvegarder maintenant" value={value} trailing={<span aria-hidden />} onClick={run} />;
}
