"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteActivity } from "@/app/actions";
import { tap } from "@/lib/haptics";

const btn = "flex min-h-12 items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50";

/** « Supprimer cette activité » : un premier appui demande confirmation, le second supprime et ramène à la liste. */
export function DeleteActivity({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false), [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const go = () => { tap(20); start(async () => {
    const r = await deleteActivity(id);
    if (!r.ok) return setErr(r.error);
    router.replace("/activities"); router.refresh();
  }); };
  if (!confirming) return (
    <button type="button" onClick={() => { tap(); setConfirming(true); }} className={`${btn} w-full border border-line bg-surface text-ink-soft`}>
      <Trash2 className="h-4 w-4" aria-hidden />Supprimer cette activité
    </button>
  );
  return (
    <div role="alertdialog" aria-labelledby="del-title" className="space-y-3 rounded-xl border border-red-500/40 bg-red-500/5 p-4">
      <p id="del-title" className="font-semibold">Supprimer définitivement cette activité ?</p>
      <p className="text-sm text-ink-soft">Ses séries, sa trace et ses photos seront effacées. Tes records seront recalculés sans elle. C’est irréversible.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={pending} onClick={() => setConfirming(false)} className={`${btn} border border-line bg-surface`}>Annuler</button>
        <button type="button" disabled={pending} onClick={go} className={`${btn} bg-red-600 text-white`}>{pending ? "Suppression…" : "Supprimer"}</button>
      </div>
      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
    </div>
  );
}
