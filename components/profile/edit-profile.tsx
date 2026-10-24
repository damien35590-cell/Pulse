"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Pencil } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Avatar } from "@/components/profile/avatar";
import { updateProfile } from "@/app/(app)/vous/actions";
import { toAvatarBlob } from "@/lib/avatar-image";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";

type Props = { name: string; image: string | null; email: string | null };

export function EditProfile({ name, image, email }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(image); // photo affichée dans la feuille ; null = retirée
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const objectUrl = useRef<string | null>(null);

  const revoke = () => { if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; };
  useEffect(() => revoke, []);

  const openSheet = () => { tap(); revoke(); setDraft(name); setPhoto(null); setRemoved(false); setPreview(image); setError(""); setOpen(true); };

  async function pick(f?: File) {
    if (!f) return;
    setError(""); setBusy(true);
    try {
      const blob = await toAvatarBlob(f);
      revoke(); objectUrl.current = URL.createObjectURL(blob);
      setPhoto(blob); setPreview(objectUrl.current); setRemoved(false);
    } catch { setError("Image illisible. Essaie une autre photo."); }
    setBusy(false);
    if (input.current) input.current.value = ""; // permet de rechoisir le même fichier
  }

  const removePhoto = () => { tap(); revoke(); setPhoto(null); setPreview(null); setRemoved(true); };

  const save = () => {
    tap(); setError("");
    const fd = new FormData();
    fd.set("name", draft);
    if (photo) fd.set("file", photo, "avatar.webp");
    else if (removed) fd.set("remove", "1");
    start(async () => {
      const r = await updateProfile(fd);
      if (r.ok) setOpen(false); else setError(r.error);
    });
  };

  const disabled = pending || busy || !draft.trim();
  return (
    <>
      <header className="flex items-center gap-4">
        <button type="button" onClick={openSheet} aria-label="Modifier le profil" className="relative shrink-0 select-none touch-manipulation rounded-full transition duration-150 ease-snappy active:scale-95">
          <Avatar name={name} image={image} className="size-16 text-3xl" />
          <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-brand text-brand-ink"><Pencil className="size-3" aria-hidden /></span>
        </button>
        <button type="button" onClick={openSheet} tabIndex={-1} className="min-w-0 flex-1 select-none touch-manipulation text-left active:opacity-60">
          <h1 className="truncate font-display text-3xl font-bold leading-none">{name}</h1>
          <p className="truncate text-sm text-ink-soft">{email}</p>
        </button>
      </header>

      <BottomSheet open={open} onClose={() => !pending && setOpen(false)} title="Modifier le profil">
        <div className="mt-4 flex flex-col items-center gap-3">
          <Avatar name={draft || name} image={preview} className={cn("size-32 text-5xl", (pending || busy) && "opacity-60")} />
          <div className="flex flex-wrap justify-center gap-2">
            <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <button type="button" disabled={pending} onClick={() => { tap(); input.current?.click(); }} className={cn(ui.btnSecondary, "h-12 bg-surface-3 px-4 text-sm")}>
              <Camera className="size-4" aria-hidden />Changer la photo
            </button>
            {preview && <button type="button" disabled={pending} onClick={removePhoto} className={cn(ui.btnSecondary, "h-12 bg-surface-3 px-4 text-sm")}>Retirer la photo</button>}
          </div>
        </div>
        <label className="mt-5 block">
          <span className={ui.label}>Nom</span>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} autoComplete="nickname" disabled={pending}
            className="mt-1.5 h-14 w-full rounded-xl bg-surface-3 px-4 text-base text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand" />
        </label>
        {error && <p role="alert" className="mt-3 text-sm font-medium text-bad">{error}</p>}
        <button type="button" onClick={save} disabled={disabled} className={cn(ui.btnPrimary, "mt-6 w-full")}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
      </BottomSheet>
    </>
  );
}
