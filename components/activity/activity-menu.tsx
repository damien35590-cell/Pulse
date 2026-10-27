"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { deleteActivity } from "@/app/actions";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** « … » de la barre du haut d'une fiche d'activité : menu en feuille (« Renommer » si la page le permet, « Supprimer » confirmé par une seconde feuille). */
export function ActivityMenu({ id, onRename }: { id: string; onRename?: () => void }) {
  const [menu, setMenu] = useState(false), [confirm, setConfirm] = useState(false), [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const remove = () => { tap(20); setErr(null); start(async () => {
    const r = await deleteActivity(id);
    if (!r.ok) { setErr(r.error); setMenu(true); return; }
    router.replace("/activities"); router.refresh();
  }); };

  return (
    <>
      <button type="button" disabled={pending} onClick={() => { tap(); setMenu(true); }} aria-label="Plus d’options" aria-haspopup="dialog" className={cn(ui.iconBtn, "disabled:opacity-40")}>
        <MoreHorizontal className="size-6" aria-hidden />
      </button>
      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Cette activité">
        {err && <p role="alert" className="mt-1 text-sm font-medium text-bad">{err}</p>}
        <div className="mt-4 grid gap-1">
          {onRename && (
            <button
              type="button"
              onClick={() => { tap(); setMenu(false); onRename(); }}
              className="flex h-14 w-full items-center gap-3 rounded-tile px-3 text-base font-semibold text-ink select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3"
            >
              <Pencil className="size-5" aria-hidden />Renommer
            </button>
          )}
          <button
            type="button"
            onClick={() => { tap(); setMenu(false); setConfirm(true); }}
            className="flex h-14 w-full items-center gap-3 rounded-tile px-3 text-base font-semibold text-bad select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3"
          >
            <Trash2 className="size-5" aria-hidden />Supprimer
          </button>
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
        title="Supprimer cette activité ?"
        message="Ses séries, sa trace et ses photos seront effacées. Tes records et tes badges seront recalculés sans elle. C’est irréversible."
        confirmLabel="Supprimer"
        destructive
      />
    </>
  );
}
