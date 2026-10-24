"use client";
import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { SettingsRow } from "@/components/ui/settings-row";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";

// Étiquettes en <span> : le Segmented leur donne une marge plus étroite, « Sombre » ne se tronque plus.
const OPTIONS = [
  { value: "system", label: <span>Auto</span> },
  { value: "light", label: <span>Clair</span> },
  { value: "dark", label: <span>Sombre</span> },
] as const;

/** Ligne « Apparence » : Auto (suit le téléphone), Clair ou Sombre. */
export function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  useEffect(() => setChoice(getTheme()), []);
  return (
    <SettingsRow
      icon={<Palette aria-hidden />}
      title="Apparence"
      trailing={<Segmented className="w-44 shrink-0" size="sm" options={OPTIONS} value={choice} onChange={(v) => { setChoice(v); setTheme(v); }} />}
    />
  );
}
