"use client";
import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
] as const;

/** Ligne « Apparence » : Automatique (suit le téléphone), Clair ou Sombre. */
export function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(getTheme()), []);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
      <span className="font-display text-lg font-bold">Apparence</span>
      <Segmented
        className="w-64 max-w-[65%]"
        options={OPTIONS}
        value={choice}
        onChange={(v) => { setChoice(v); setTheme(v); }}
      />
    </div>
  );
}
