"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, Check, ChevronDown } from "lucide-react";
import { tap } from "@/lib/haptics";
import { cn } from "@/lib/utils";

/** Menu de tri de la liste d'activités : met à jour le paramètre `sort` de l'URL. */
export function SortMenu({ value, options }: { value: string; options: [string, string][] }) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(([k]) => k === value)?.[1] ?? options[0][1];

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  function pick(v: string) {
    tap(6);
    setOpen(false);
    if (v === value) return;
    const p = new URLSearchParams(sp.toString());
    p.delete("n");
    if (v === "recent") p.delete("sort"); else p.set("sort", v);
    router.push(`${path}${p.size ? `?${p}` : ""}`, { scroll: false });
  }

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm font-medium">
        <ArrowDownUp className="h-4 w-4 text-ink-soft" aria-hidden />
        <span className="sr-only">Trier par : </span>{current}
        <ChevronDown className={cn("h-4 w-4 text-ink-soft transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-56 origin-top-right rounded-xl border border-line bg-surface p-1.5 shadow-lg shadow-black/10">
          <p className="px-3 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">Trier par</p>
          {options.map(([k, l]) => (
            <button key={k} type="button" role="menuitemradio" aria-checked={k === value} onClick={() => pick(k)}
              className={cn("flex min-h-11 w-full items-center justify-between rounded-lg px-3 text-left text-[15px] transition-colors hover:bg-surface-2", k === value ? "font-bold text-brand" : "text-ink")}>
              {l}{k === value && <Check className="h-4 w-4" aria-hidden />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
