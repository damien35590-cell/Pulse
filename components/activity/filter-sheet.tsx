"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, SlidersHorizontal } from "lucide-react";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Switch } from "@/components/ui/switch";

type Opt = [string, string];

function Choice({ label, value, options, onPick }: { label: string; value: string; options: Opt[]; onPick: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="mt-5">
      <p className={ui.label}>{label}</p>
      <div className="mt-1">
        {options.map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={k === value} onClick={() => { tap(6); onPick(k); }}
            className={cn("flex min-h-12 w-full items-center justify-between rounded-tile px-1 text-left select-none touch-manipulation active:opacity-70", k === value ? "font-semibold text-ink" : "text-ink-soft")}>
            {l}{k === value && <Check className="size-5 text-brand" aria-hidden />}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Réglages de la liste d'activités (tri, activités douces, période), conservés dans l'URL. */
export function FilterSheet({ sort, soft, period, sorts, periods }: { sort: string; soft: boolean; period: string; sorts: Opt[]; periods: Opt[] }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ sort, soft, period });
  const changed = sort !== "recent" || soft || period !== "all";

  function apply() {
    const p = new URLSearchParams(sp.toString());
    p.delete("n");
    if (d.sort === "recent") p.delete("sort"); else p.set("sort", d.sort);
    if (d.period === "all") p.delete("p"); else p.set("p", d.period);
    if (d.soft) p.set("soft", "1"); else { p.delete("soft"); if (["EBIKE", "WALK"].includes(p.get("t") ?? "")) p.delete("t"); }
    setOpen(false);
    router.push(`${path}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  return (
    <>
      <button type="button" aria-label="Trier et filtrer" aria-haspopup="dialog" onClick={() => { tap(6); setD({ sort, soft, period }); setOpen(true); }} className={cn(ui.iconBtn, "relative")}>
        <SlidersHorizontal className="size-5" aria-hidden />
        {changed && <span aria-hidden className="absolute right-3 top-3 size-2.5 rounded-full bg-brand ring-2 ring-bg" />}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Trier et filtrer">
        <Choice label="Trier par" value={d.sort} options={sorts} onPick={(v) => setD((x) => ({ ...x, sort: v }))} />
        <Switch className="mt-3" checked={d.soft} onChange={(v) => setD((x) => ({ ...x, soft: v }))} label="Inclure les activités douces" description="E-bike et marche" />
        <Choice label="Période" value={d.period} options={periods} onPick={(v) => setD((x) => ({ ...x, period: v }))} />
        <button type="button" onClick={apply} className={cn(ui.btnPrimary, "mt-6 w-full")}>Appliquer</button>
      </BottomSheet>
    </>
  );
}
