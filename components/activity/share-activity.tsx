"use client";
import { useEffect, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/**
 * Action principale de la fiche d'activité, dans la zone du pouce : partage natif (Web Share API) d'un court résumé
 * (titre, distance, durée, allure) avec le lien ; sinon copie dans le presse-papiers et petit message de confirmation.
 */
export function ShareActivity({ title, summary, className }: { title: string; /** « 8,02 km · 42:10 · 5:15 /km » */ summary: string; className?: string }) {
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2500); return () => clearTimeout(t); }, [toast]);

  async function share() {
    tap();
    const url = window.location.href, text = `${title}\n${summary}`;
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; }
      catch (e) { if ((e as Error).name === "AbortError") return; } // annulé par l'utilisateur : rien à faire
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setToast("Résumé copié");
    } catch {
      setToast("Copie impossible");
    }
  }

  return (
    <>
      <button type="button" onClick={share} className={cn(ui.btnPrimary, "w-full", className)}>
        <Share2 className="size-5" aria-hidden />
        Partager
      </button>
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-sm items-center gap-2 rounded-tile bg-ink px-4 py-3 text-sm font-semibold text-bg shadow-pop">
          <Check className="size-4 text-good" aria-hidden />{toast}
        </div>
      )}
    </>
  );
}
