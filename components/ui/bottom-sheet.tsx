"use client";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

type SheetProps = { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; className?: string };

/**
 * Feuille modale sur <dialog> natif : focus piégé, Échap, et sur Chrome Android le geste « retour » ferme la feuille
 * au lieu de quitter la page (CloseWatcher). Remplace confirm()/alert(), qui cassent l'effet appli.
 */
export function BottomSheet({ open, onClose, title, children, className }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    document.documentElement.style.overflow = open ? "hidden" : ""; // la page derrière ne défile plus
    return () => { document.documentElement.style.overflow = ""; };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} // tap sur le voile = fermer
      className="mx-auto mb-0 mt-auto w-full max-w-md overflow-visible bg-transparent p-0 text-ink backdrop:bg-black/60 open:animate-sheet-in"
    >
      <div className={cn("max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-sheet bg-surface-2 px-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] pt-2 shadow-pop", className)}>
        <div aria-hidden className="mx-auto mb-4 h-1 w-9 rounded-full bg-ink/20" />
        {title && <h2 className="text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </dialog>
  );
}

type ConfirmProps = {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message?: React.ReactNode; confirmLabel: string; cancelLabel?: string; destructive?: boolean;
};

/** Confirmation en feuille : action principale en haut (pouce), annulation juste en dessous. */
export function ConfirmSheet({ open, onClose, onConfirm, title, message, confirmLabel, cancelLabel = "Annuler", destructive }: ConfirmProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {message && <p className="mt-1 text-sm text-ink-soft">{message}</p>}
      <div className="mt-6 grid gap-2">
        <button type="button" onClick={() => { onConfirm(); onClose(); }} className={cn(destructive ? ui.btnDanger : ui.btnPrimary, "w-full")}>
          {confirmLabel}
        </button>
        <button type="button" onClick={onClose} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
