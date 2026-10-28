"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil } from "lucide-react";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Props = {
  activityId: string;
  title: string;
  /** Mode piloté de l'extérieur (crayon de la barre du haut) : plus de crayon à côté du titre. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
};

/** Titre de l'activité, renommable d'un appui sur le crayon. Entrée ou sortie du champ : enregistre ; Échap ou champ vide : annule. */
export function EditableTitle({ activityId, title, editing: editingProp, onEditingChange }: Props) {
  const controlled = editingProp !== undefined;
  const [cur, setCur] = useState(title), [draft, setDraft] = useState(title), [ownEditing, setOwnEditing] = useState(false), [err, setErr] = useState(false);
  const editing = controlled ? editingProp : ownEditing;
  const setEditing = (v: boolean) => { if (v) setDraft(cur); if (controlled) onEditingChange?.(v); else setOwnEditing(v); };
  const [pending, start] = useTransition();
  const router = useRouter();
  const saving = useRef(false);
  const h1 = "font-display text-3xl font-bold leading-tight";

  async function save() {
    if (saving.current) return;
    const next = draft.trim();
    setEditing(false);
    if (!next || next === cur) return setDraft(cur);
    saving.current = true; tap(10);
    const prev = cur;
    setCur(next); setErr(false);
    const r = await fetch(`/api/activities/${activityId}/note`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: next }) }).catch(() => null);
    saving.current = false;
    if (!r?.ok) { setCur(prev); setDraft(prev); setErr(true); return; }
    start(() => router.refresh());
  }

  if (editing) return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-1 flex items-center gap-2">
      <input autoFocus value={draft} maxLength={120} aria-label="Nom de l’activité" onChange={(e) => setDraft(e.target.value)} onBlur={save}
        onKeyDown={(e) => { if (e.key === "Escape") { setDraft(cur); setEditing(false); } }}
        className={cn(h1, "min-h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-3")} />
      <button type="submit" onMouseDown={(e) => e.preventDefault()} aria-label="Enregistrer le nom" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink"><Check className="h-5 w-5" aria-hidden /></button>
    </form>
  );
  return (
    <div className="mt-1">
      <div className={cn("flex items-start gap-2", pending && "opacity-70")}>
        <h1 className={cn(h1, "min-w-0 flex-1 break-words")}>{cur}</h1>
        {!controlled && (
          <button type="button" onClick={() => { tap(); setEditing(true); }} aria-label="Renommer l’activité" className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-surface-2"><Pencil className="h-5 w-5" aria-hidden /></button>
        )}
      </div>
      {err && <p role="alert" className="text-sm font-medium text-bad">Impossible de renommer. Vérifie ta connexion et réessaie.</p>}
    </div>
  );
}
