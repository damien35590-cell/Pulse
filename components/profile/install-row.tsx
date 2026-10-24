"use client";
import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { SettingsRow } from "@/components/ui/settings-row";

type BIP = Event & { prompt: () => Promise<void> };

/** Ligne « Installer Pulse » : seulement si l'app n'est pas déjà installée (hors mode standalone) et que le navigateur propose l'installation. */
export function InstallRow() {
  const [ev, setEv] = useState<BIP | null>(null);
  useEffect(() => {
    if (matchMedia("(display-mode: standalone)").matches) return;
    const on = (e: Event) => { e.preventDefault(); setEv(e as BIP); }, done = () => setEv(null);
    addEventListener("beforeinstallprompt", on); addEventListener("appinstalled", done);
    return () => { removeEventListener("beforeinstallprompt", on); removeEventListener("appinstalled", done); };
  }, []);
  if (!ev) return null;
  return <SettingsRow icon={<Download aria-hidden />} title="Installer Pulse" value="Ajoute l’app à ton écran d’accueil" onClick={async () => { await ev.prompt(); setEv(null); }} />;
}
