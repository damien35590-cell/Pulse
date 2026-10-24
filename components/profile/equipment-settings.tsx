"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { saveEquipment } from "@/app/(app)/record/session/actions";
import { EQUIPMENT_LABELS } from "@/lib/workout/catalog";
import type { Equipment } from "@/lib/workout/catalog-data";

const KEYS = Object.keys(EQUIPMENT_LABELS) as Exclude<Equipment, "aucun">[];

/** « Matériel de muscu » : coche ce que tu as ; le catalogue d'exercices et la bibliothèque de modèles s'y adaptent. */
export function EquipmentSettings({ initial }: { initial: Equipment[] }) {
  const [mine, setMine] = useState<Equipment[]>(initial);
  const [err, setErr] = useState("");

  async function toggle(k: Equipment) {
    tap(6);
    const next = mine.includes(k) ? mine.filter((x) => x !== k) : [...mine, k];
    setMine(next);
    setErr("");
    try { setMine(await saveEquipment(next)); } catch { setErr("Pas enregistré : vérifie ta connexion."); setMine(mine); }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="font-display text-lg font-bold">Ce que tu as à disposition</p>
      <p className="text-sm text-ink-soft">Le catalogue d’exercices masque ce que tu ne peux pas faire chez toi.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {KEYS.map((k) => {
          const on = mine.includes(k);
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => toggle(k)} className={cn("inline-flex h-12 touch-manipulation items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95", on ? "bg-ink text-bg" : "bg-surface-2 text-ink-soft")}>
              {on && <Check className="size-4" aria-hidden />}{EQUIPMENT_LABELS[k]}
            </button>
          );
        })}
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-bad">{err}</p>}
    </div>
  );
}
