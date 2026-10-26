"use client";
import { Frown, Laugh, Meh, Smile, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Ressenti en 5 smileys ; tonalités en tokens (vert → ambre → rouge). Partagé par la fiche d'activité et la saisie manuelle.
const FEELS: { v: number; Icon: LucideIcon; label: string; tone: string }[] = [
  { v: 1, Icon: Laugh, label: "Super", tone: "text-good" },
  { v: 2, Icon: Smile, label: "Bien", tone: "text-good" },
  { v: 3, Icon: Meh, label: "Correct", tone: "text-ink" },
  { v: 4, Icon: Frown, label: "Fatigué", tone: "text-warn" },
  { v: 5, Icon: Zap, label: "Difficile", tone: "text-bad" },
];

/** Valeurs de l'enum Feeling en base (Activity.feeling), dans l'ordre des smileys : 1 = GREAT … 5 = HARD. */
export const FEELING_KEYS = ["GREAT", "GOOD", "OK", "TIRED", "HARD"] as const;

export function FeelPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Ressenti" className="grid grid-cols-5">
      {FEELS.map(({ v, Icon, label, tone }) => {
        const active = value === v, muted = value != null && !active;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-tile select-none touch-manipulation transition duration-150 ease-snappy active:scale-95",
              active && "scale-105 bg-surface-2",
              muted && "opacity-45",
            )}
          >
            <Icon className={cn("size-6", active ? tone : "text-ink-soft")} strokeWidth={active ? 2.25 : 1.75} aria-hidden />
            <span className={cn("text-xs", active ? "font-semibold text-ink" : "text-ink-soft")}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
