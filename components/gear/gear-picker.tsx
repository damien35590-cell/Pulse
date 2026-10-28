"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check } from "lucide-react";
import { GEAR_KINDS, type GearKindKey } from "@/lib/gear";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

export type PickOpt = { id: string; name: string; kind: GearKindKey; km: number; worn: string[] };

/** Matériel d'une sortie : plusieurs choix possibles (vélo + home trainer). Les composants suivent leur support. */
export function GearPicker({ activityId, options, selected, retired }: { activityId: string; options: PickOpt[]; selected: string[]; retired: string[] }) {
  const [cur, setCur] = useState(selected);
  const [pending, start] = useTransition();
  const router = useRouter();

  async function toggle(id: string) {
    tap(10);
    const prev = cur, next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    setCur(next);
    const r = await fetch(`/api/activities/${activityId}/gear`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gearIds: next }) }).catch(() => null);
    if (!r?.ok) return setCur(prev);
    start(() => router.refresh());
  }

  const worn = options.filter((o) => cur.includes(o.id)).flatMap((o) => o.worn);
  return (
    <section aria-label="Matériel utilisé">
      <div className="mb-2 flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Matériel</h2><Link href="/gear" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">Gérer</Link></div>
      <div className={cn("flex flex-wrap gap-2", pending && "opacity-70")}>
        {options.map((o) => {
          const on = cur.includes(o.id), I = GEAR_KINDS[o.kind].icon;
          return (
            <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(o.id)}
              className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold", on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface")}>
              {on ? <Check className="h-4 w-4" aria-hidden /> : <I className="h-4 w-4" aria-hidden />}{o.name}
              {o.worn.length > 0 && <AlertTriangle className={cn("h-4 w-4", !on && "text-bad")} aria-label="Seuil critique dépassé" />}
            </button>
          );
        })}
        {retired.map((n) => <span key={n} className="inline-flex min-h-11 items-center rounded-full bg-surface-2 px-3.5 text-sm text-ink-soft">{n} (retiré)</span>)}
      </div>
      {worn.length > 0 && <p role="status" className="mt-2 flex gap-2 rounded-xl bg-bad/10 px-3 py-2.5 text-sm text-bad"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />À remplacer : {worn.join(", ")}.</p>}
    </section>
  );
}
