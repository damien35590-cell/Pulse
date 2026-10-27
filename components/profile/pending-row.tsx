"use client";
import { useCallback, useEffect, useState } from "react";
import { CloudOff } from "lucide-react";
import { SettingsRow } from "@/components/ui/settings-row";
import { PENDING_EVENT, countPending, flushPending } from "@/lib/workout/pending-uploads";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Pastille « séances en attente d'envoi » (muscu enregistrée hors ligne ou en échec) avec « Renvoyer » ; absente quand la file est vide. */
export function PendingRow() {
  const [n, setN] = useState(0);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => { countPending().then(setN).catch(() => setN(0)); }, []);
  useEffect(() => {
    refresh();
    addEventListener(PENDING_EVENT, refresh);
    return () => removeEventListener(PENDING_EVENT, refresh);
  }, [refresh]);
  if (!n) return null;

  async function resend() {
    setBusy(true);
    await flushPending(true).catch(() => null);
    setBusy(false);
    refresh();
  }
  return (
    <SettingsRow
      icon={<CloudOff aria-hidden />}
      title={`${n} séance${n > 1 ? "s" : ""} en attente`}
      value="Gardée sur le téléphone, envoi automatique"
      trailing={<button type="button" onClick={resend} disabled={busy} className={cn(ui.btnSecondary, "min-h-0 shrink-0 px-3 py-1.5 text-sm")}>{busy ? "Envoi…" : "Renvoyer"}</button>}
    />
  );
}
