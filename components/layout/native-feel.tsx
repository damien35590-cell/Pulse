"use client";
import { useEffect } from "react";

/**
 * Comportements « appli native » globaux.
 * Chrome Android ouvre un menu (ouvrir dans un onglet, copier le lien, télécharger l'image…) au long-press sur un lien,
 * une image ou une carte : on le supprime partout, sauf dans les champs de saisie et sous [data-allow-menu].
 */
export function NativeFeel() {
  useEffect(() => {
    // Écrans tactiles uniquement : le clic droit garde son menu sur PC.
    if (!matchMedia("(hover: none)").matches) return;
    const onMenu = (e: MouseEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t || t.closest("input, textarea, [contenteditable], [data-allow-menu]")) return;
      if (t.closest("a, button, img, svg, [role='button'], [role='tab']")) e.preventDefault();
    };
    document.addEventListener("contextmenu", onMenu);
    return () => document.removeEventListener("contextmenu", onMenu);
  }, []);
  return null;
}
