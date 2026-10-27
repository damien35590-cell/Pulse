"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { deleteRunProgram } from "@/app/actions";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { RunProgramForm } from "@/components/training/run-program-form";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

const row = "flex min-h-14 w-full items-center gap-3 rounded-tile bg-surface px-4 py-2 text-left font-semibold select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3";

/** Bouton « ⋯ » de la page : « Recommencer un nouveau programme » (formulaire en feuille) et « Supprimer ce programme » (confirmation en feuille). Programme running. */
export function ProgramMenu({ programId, vma }: { programId: string; vma: { vmaKmh: number; label: string } }) {
  const [sheet, setSheet] = useState<"menu" | "restart" | "delete" | null>(null);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const remove = () => start(async () => {
    const r = await deleteRunProgram(programId);
    if (!r.ok) { setErr(r.error); setSheet("menu"); return; }
    router.refresh();
  });

  return (
    <>
      <button type="button" aria-label="Plus d’actions" aria-haspopup="dialog" onClick={() => { tap(); setErr(null); setSheet("menu"); }} className={cn(ui.iconBtn, "-mr-2")}>
        <MoreHorizontal className="size-6" aria-hidden />
      </button>
      <BottomSheet open={sheet === "menu"} onClose={() => setSheet(null)} title="Programme running">
        <div className="mt-3 grid gap-2 pb-2">
          <button type="button" onClick={() => setSheet("restart")} className={row}><RotateCcw className="size-5 text-ink-soft" aria-hidden />Recommencer un nouveau programme</button>
          <button type="button" onClick={() => setSheet("delete")} className={cn(row, "text-bad")}><Trash2 className="size-5" aria-hidden />Supprimer ce programme</button>
          {err && <p role="alert" className="text-sm font-semibold text-bad">{err}</p>}
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === "restart"} onClose={() => setSheet(null)} title="Recommencer un nouveau programme">
        <p className="mt-1 text-sm text-ink-soft">Le programme en cours est abandonné, un nouveau « Reprise & VMA » démarre avec ta VMA.</p>
        <div className="mt-3 pb-2"><RunProgramForm current={{ vmaKmh: vma.vmaKmh, label: vma.label, estimated: false }} replacing onDone={() => setSheet(null)} /></div>
      </BottomSheet>
      <ConfirmSheet open={sheet === "delete"} onClose={() => setSheet(null)} onConfirm={remove} destructive
        title="Supprimer ce programme ?" message="Il disparaît de Pulse, et les séances déjà envoyées sont retirées de ta montre. Tes sorties restent dans l’historique." confirmLabel={pending ? "Suppression…" : "Supprimer le programme"} />
    </>
  );
}
