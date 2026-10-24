"use client";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

/**
 * Interrupteur on / off sur toute la ligne : libellé (+ phrase) à gauche, piste à droite.
 * Toute la ligne est la cible tactile (56 px de haut), retour haptique au changement.
 */
export function Switch({ checked, onChange, label, description, disabled, className }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { tap(6); onChange(!checked); }}
      className={cn("flex min-h-14 w-full items-center gap-3 py-2 text-left select-none touch-manipulation transition duration-150 ease-snappy active:opacity-70 disabled:opacity-40", className)}
    >
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{label}</span>
        {description && <span className="block text-sm text-ink-soft">{description}</span>}
      </span>
      <span aria-hidden className={cn("relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ease-snappy", checked && !disabled ? "bg-brand" : "bg-surface-3")}>
        <span className={cn("absolute left-1 top-1 size-6 rounded-full shadow-card transition duration-200 ease-snappy", checked ? "translate-x-6" : "", checked && !disabled ? "bg-brand-ink" : "bg-ink-soft")} />
      </span>
    </button>
  );
}
