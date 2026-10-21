"use client";
import { useEffect } from "react";

/**
 * Comportements « appli native » globaux.
 * Au long-press, Chrome Android sélectionne le texte (barre Copier, bandeau de recherche Google) ou ouvre un menu
 * (ouvrir dans un onglet, copier le lien, télécharger l'image…) : on le supprime partout sur écran tactile,
 * sauf dans les champs de saisie, sous .selectable et sous [data-allow-menu].
 */
export function NativeFeel() {
  useEffect(() => {
    // Écrans tactiles uniquement : la souris garde sélection et clic droit sur PC.
    if (!matchMedia("(pointer: coarse)").matches) return;
    const allowed = "input, textarea, [contenteditable], .selectable, [data-allow-menu]";
    const onMenu = (e: Event) => {
      const t = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
      if (t?.closest(allowed)) return;
      e.preventDefault();
    };
    document.addEventListener("contextmenu", onMenu);
    // Filet de sécurité si un navigateur ignore user-select.
    document.addEventListener("selectstart", onMenu);
    return () => {
      document.removeEventListener("contextmenu", onMenu);
      document.removeEventListener("selectstart", onMenu);
    };
  }, []);
  return null;
}
