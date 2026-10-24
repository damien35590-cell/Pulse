"use client";
import { useState } from "react";
import { BookmarkPlus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { saveTemplate } from "@/app/(app)/record/session/actions";

/** « Enregistrer comme modèle » dans le détail d'une séance passée : le nom est pré-rempli, modifiable. Les performances ne sont pas copiées. */
export function SaveTemplateButton({ activityId, defaultName }: { activityId: string; defaultName: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    tap(12);
    setBusy(true);
    setErr("");
    const r = await saveTemplate(activityId, name).catch(() => ({ ok: false as const, error: "Impossible d’enregistrer le modèle : réessaie." }));
    setBusy(false);
    if (r.ok) setSaved(r.name); else setErr(r.error);
  }

  return (
    <>
      <button type="button" onClick={() => { tap(8); setName(defaultName); setSaved(null); setErr(""); setOpen(true); }} className={cn(ui.btnSecondary, "w-full")}>
        <BookmarkPlus className="size-5" aria-hidden />Enregistrer comme modèle
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Enregistrer comme modèle">
        {saved ? (
          <div className="mt-4">
            <p role="status" className="flex items-center gap-2 font-semibold"><Check className="size-5 text-good" strokeWidth={3} aria-hidden />« {saved} » est dans tes modèles.</p>
            <button type="button" onClick={() => setOpen(false)} className={cn(ui.btnPrimary, "mt-6 w-full")}>Fermer</button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-sm text-ink-soft">Les exercices, séries et repos de cette séance, sans tes performances.</p>
            <label className="mt-4 block">
              <span className={ui.label}>Nom du modèle</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                autoComplete="off"
                enterKeyHint="done"
                className="mt-1 h-14 w-full rounded-tile bg-surface px-4 text-base font-semibold text-ink caret-brand outline-none ring-1 ring-inset ring-line focus-visible:ring-brand"
              />
            </label>
            {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
            <div className="mt-6 grid gap-2">
              <button type="button" disabled={busy} onClick={save} className={cn(ui.btnPrimary, "w-full")}>{busy ? "Enregistrement…" : "Enregistrer"}</button>
              <button type="button" onClick={() => setOpen(false)} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>Annuler</button>
            </div>
          </div>
        )}
      </BottomSheet>
    </>
  );
}
