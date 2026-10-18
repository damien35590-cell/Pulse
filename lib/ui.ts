/**
 * Recettes de classes partagées : une seule source pour l'aspect des cartes, boutons et libellés.
 * À combiner avec cn() : cn(ui.card, "p-4").
 */
export const ui = {
  /** Carte : pas de bordure en sombre, la séparation vient de la surface plus claire + liseré interne. */
  card: "rounded-card bg-surface shadow-card",
  /** Carte cliquable : enfoncement léger et immédiat, fond qui s'éclaircit. */
  pressCard: "select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-2",
  /** Libellé de donnée : petit, capitales, gris lisible (5,4:1 sur carte). */
  label: "text-label uppercase text-ink-mute",
  /** Bouton principal : texte quasi noir sur orange = contraste 5,8:1 (le blanc ne fait que 3,4:1). */
  btnPrimary:
    "inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand px-6 text-base font-semibold text-brand-ink shadow-glow select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.97] active:brightness-90 disabled:opacity-40 disabled:shadow-none",
  btnSecondary:
    "inline-flex h-14 items-center justify-center gap-2 rounded-full bg-surface-2 px-6 text-base font-semibold text-ink select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.97] active:bg-surface-3 disabled:opacity-40",
  btnDanger:
    "inline-flex h-14 items-center justify-center gap-2 rounded-full bg-bad/15 px-6 text-base font-semibold text-bad select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.97] active:bg-bad/25",
  /** Bouton icône : cible de 48 px (norme Android), retour au toucher par un disque. */
  iconBtn:
    "grid size-12 shrink-0 place-items-center rounded-full text-ink select-none touch-manipulation transition duration-150 ease-snappy active:scale-90 active:bg-surface-2",
  chip: "inline-flex h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs font-medium text-ink-soft",
} as const;
