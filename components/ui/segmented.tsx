"use client";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

type Option<T extends string> = { value: T; label: string };

/** Sélecteur à onglets (FC / Puissance, Semaine / Mois…). Cibles de 40 px, retour haptique au changement. */
export function Segmented<T extends string>({ options, value, onChange, size = "md", className }: {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="tablist" className={cn("grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface-2 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => { if (!active) { tap(6); onChange(o.value); } }}
            className={cn(
              "touch-manipulation truncate rounded-full px-3 font-semibold transition duration-200 ease-snappy",
              size === "sm" ? "h-8 text-xs" : "h-10 text-sm",
              active ? "bg-surface-3 text-ink shadow-card" : "text-ink-soft active:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
