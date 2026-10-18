export type ThemeChoice = "system" | "light" | "dark";

const KEY = "pulse-theme";
const META_COLOR = { light: "#F7F7FA", dark: "#0A0A0C" } as const;
// Valeurs d'origine (layout.tsx) : une balise par préférence système.
const AUTO_COLOR: Record<string, string> = { "(prefers-color-scheme: light)": META_COLOR.light, "(prefers-color-scheme: dark)": META_COLOR.dark };

export function getTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "light" || t === "dark") return t;
  } catch {}
  return "system";
}

export function setTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {}
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.dataset.theme = choice;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    m.content = choice === "system" ? (AUTO_COLOR[m.media] ?? m.content) : META_COLOR[choice];
  });
}
