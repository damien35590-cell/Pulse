"use client";
import { useEffect, useState } from "react";

type BIP = Event & { prompt: () => Promise<void> };

/** Chrome Android propose l'installation via `beforeinstallprompt` ; sinon on explique le geste. */
export function InstallPrompt({ variant = "banner" }: { variant?: "banner" | "card" }) {
  const [ev, setEv] = useState<BIP | null>(null), [installed, setInstalled] = useState(false), [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (matchMedia("(display-mode: standalone)").matches) { setInstalled(true); return; }
    try { if (localStorage.getItem("pulse-install-dismissed")) setHidden(true); } catch {}
    const on = (e: Event) => { e.preventDefault(); setEv(e as BIP); }, done = () => setInstalled(true);
    addEventListener("beforeinstallprompt", on); addEventListener("appinstalled", done);
    return () => { removeEventListener("beforeinstallprompt", on); removeEventListener("appinstalled", done); };
  }, []);
  if (installed) return variant === "card" ? <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-soft">Pulse est installée sur cet appareil.</p> : null;
  if (variant === "banner" && (!ev || hidden)) return null;
  const install = async () => { await ev?.prompt(); setEv(null); };
  return (
    <section className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5" aria-label="Installer l’application">
      <div className="min-w-0 flex-1"><p className="font-bold">Installer Pulse</p><p className="text-sm text-ink-soft">{ev ? "Ajoutez l’app à votre écran d’accueil." : "Dans Chrome : menu ⋮, puis « Installer l’application »."}</p></div>
      {ev && <button onClick={install} className="min-h-11 rounded-full bg-brand px-4 font-semibold text-brand-ink">Installer</button>}
      {variant === "banner" && <button onClick={() => { try { localStorage.setItem("pulse-install-dismissed", "1"); } catch {} setHidden(true); }} className="min-h-11 px-2 text-sm text-ink-soft" aria-label="Masquer">Plus tard</button>}
    </section>
  );
}
