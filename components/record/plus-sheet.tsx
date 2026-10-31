"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Dumbbell, FileUp, Loader2, PencilLine, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { fmtAgo } from "@/lib/format";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NewSessionSheet } from "@/components/workout/new-session-sheet";
import { plusMenu, type PlusMenu } from "@/app/(app)/record/actions";

const row = "flex min-h-14 w-full items-center gap-3 rounded-tile bg-surface px-4 py-2 text-left select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3 disabled:opacity-60";
const tile = "grid size-10 shrink-0 place-items-center rounded-tile bg-surface-2 text-ink-soft";
const plural = (n: number) => (n > 1 ? `${n} nouvelles activités` : "1 nouvelle activité");

type SyncResult = { total?: number; error?: string; errors?: string[]; retryAfterS?: number; lastSyncAt?: string | null };

/**
 * Feuille du bouton « + » : séance de muscu (seule action en Volt), import de fichier, synchro Intervals.icu + Google Fit, saisie manuelle.
 * Le toast vit hors de la feuille : il s'affiche aussi si on la ferme pendant la synchro.
 */
export function PlusSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [menu, setMenu] = useState<PlusMenu | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pick, setPick] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => { if (open) plusMenu().then(setMenu).catch(() => {}); }, [open]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), toast.ok ? 2500 : 6000); return () => clearTimeout(t); }, [toast]);

  function workout() {
    tap(12);
    onClose();
    // Suggestion du jour (même source que le sous-titre) : droit à la préparation ; sans elle, choix du modèle.
    if (menu?.nextSession) router.push("/record/session?suggest=1");
    else setPick(true);
  }

  async function sync() {
    if (syncing) return;
    tap();
    setSyncing(true);
    let j: SyncResult = {}, status = 0;
    try { const r = await fetch("/api/sync/now", { method: "POST" }); status = r.status; j = await r.json(); } catch { /* hors ligne */ }
    setSyncing(false);
    if (j.lastSyncAt !== undefined) setMenu((m) => m && { ...m, lastSyncAt: j.lastSyncAt ?? null });
    onClose();
    if (status === 200) {
      tap();
      // Une source en échec (jeton Google refusé…) se voit, même si l'autre a réussi.
      const failed = j.errors?.[0];
      setToast(failed ? { text: `${j.total ? `${plural(j.total)} · ` : ""}${failed}`, ok: false } : { text: j.total ? plural(j.total) : "Déjà à jour", ok: true });
      if (j.total) router.refresh();
    } else if (status === 429) {
      const min = Math.ceil((j.retryAfterS ?? 60) / 60);
      setToast({ text: `Synchro déjà faite : réessaie dans ${min} min`, ok: false });
    } else setToast({ text: status ? "Synchronisation impossible" : "Connexion impossible, réessaie", ok: false });
  }

  const subtitle = menu ? (menu.nextSession ?? "Choisir un modèle") : " ";

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Ajouter">
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={workout} className={cn(ui.btnPrimary, "w-full flex-col gap-0 leading-tight")}>
            <span className="flex items-center gap-2"><Dumbbell className="size-5" aria-hidden />Séance de musculation</span>
            <span className="max-w-full truncate text-xs font-medium opacity-70">{subtitle}</span>
          </button>
          <button type="button" onClick={() => { tap(); onClose(); setPick(true); }} className="flex min-h-12 w-full items-center justify-center rounded-full text-label text-ink-soft select-none touch-manipulation transition active:bg-surface-3 active:text-ink">
            Autre séance
          </button>

          <Link href="/import" onClick={() => { tap(); onClose(); }} className={row}>
            <span className={tile}><FileUp className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Importer un fichier</span>
              <span className="block text-sm text-ink-mute">FIT, GPX ou TCX</span>
            </span>
          </Link>

          <button type="button" onClick={sync} disabled={syncing} aria-busy={syncing} className={row}>
            <span className={tile}>{syncing ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <RefreshCw className="size-5" aria-hidden />}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{syncing ? "Synchronisation…" : "Synchroniser maintenant"}</span>
              <span className="block truncate text-sm text-ink-mute">{menu?.lastSyncAt ? `Dernière synchro ${fmtAgo(menu.lastSyncAt)}` : "Intervals.icu et Google Fit"}</span>
            </span>
          </button>

          <Link href="/record" onClick={() => { tap(); onClose(); }} className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-ink-mute select-none touch-manipulation transition active:bg-surface-3 active:text-ink">
            <PencilLine className="size-4" aria-hidden />Saisie manuelle
          </Link>
        </div>
      </BottomSheet>

      <NewSessionSheet open={pick} onClose={() => setPick(false)} onNavigate={() => setPick(false)} />

      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-[60] mx-auto flex max-w-sm items-center gap-2 rounded-tile bg-ink px-4 py-3 text-sm font-semibold text-bg shadow-pop">
          {toast.ok && <Check className="size-4 text-good" aria-hidden />}{toast.text}
        </div>
      )}
    </>
  );
}
