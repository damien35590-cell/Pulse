"use client";
import { useEffect, useState } from "react";

/**
 * Couleurs des tokens du thème, lues dans les variables CSS (app/globals.css), pour les props que CSS ne pilote pas
 * (Recharts : stroke, fill, tick…). Se met à jour quand `data-theme` change ou quand le thème système change.
 * Valeurs prêtes à l'emploi (`rgb(r g b)`). Règle des graphiques de données :
 * `brand` (aplat) pour les barres et remplissages, `brandText` (vert foncé en clair) pour traits et points, `inkMute` pour la référence.
 */
export type ThemeColors = { brand: string; brandText: string; ink: string; inkSoft: string; inkMute: string; surface: string; surface2: string; line: string; good: string };

const VARS: Record<keyof ThemeColors, string> = {
  brand: "--brand", brandText: "--brand-text", ink: "--ink", inkSoft: "--ink-soft", inkMute: "--ink-mute", surface: "--surface", surface2: "--surface-2", line: "--line", good: "--good",
};
// Avant le premier rendu client (serveur) : pas de couleur en dur, le trait hérite du texte.
const FALLBACK = Object.fromEntries(Object.keys(VARS).map((k) => [k, "currentColor"])) as ThemeColors;

function read(): ThemeColors {
  const css = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(VARS).map(([k, v]) => [k, `rgb(${css.getPropertyValue(v).trim()})`])) as ThemeColors;
}

export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(FALLBACK);
  useEffect(() => {
    const update = () => setColors(read());
    update();
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", update);
    return () => { obs.disconnect(); mq.removeEventListener("change", update); };
  }, []);
  return colors;
}
