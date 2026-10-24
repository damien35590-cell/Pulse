"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Palette, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { SettingsRow } from "@/components/ui/settings-row";
import { getTheme, setTheme, type ThemeChoice } from "@/lib/theme";

const OPTIONS = [
  { value: "system", label: <Monitor className="mx-auto size-5" aria-label="Auto" /> },
  { value: "light", label: <Sun className="mx-auto size-5" aria-label="Clair" /> },
  { value: "dark", label: <Moon className="mx-auto size-5" aria-label="Sombre" /> },
] as const;

/** Ligne « Apparence » : Auto (suit le téléphone), Clair ou Sombre, en icônes de 48 px. */
export function ThemePicker() {
  const [choice, setChoice] = useState<ThemeChoice>("system");
  const [dark, setDark] = useState(false);
  useEffect(() => { setChoice(getTheme()); setDark(matchMedia("(prefers-color-scheme: dark)").matches); }, []);
  const value = choice === "system" ? `Auto (${dark ? "sombre" : "clair"})` : choice === "light" ? "Clair" : "Sombre";
  return (
    <SettingsRow
      icon={<Palette aria-hidden />}
      title="Apparence"
      value={value}
      trailing={<Segmented className="w-40 shrink-0" size="lg" options={OPTIONS} value={choice} onChange={(v) => { setChoice(v); setTheme(v); }} />}
    />
  );
}
