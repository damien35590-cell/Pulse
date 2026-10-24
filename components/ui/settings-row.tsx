"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";

type Props = {
  /** Élément icône (ex. `<Flag />`) : un élément, pas un composant, pour pouvoir venir d'une page serveur. */
  icon: ReactNode;
  title: string;
  /** Résumé de la valeur actuelle (gris, tronqué sur une ligne). */
  value?: ReactNode;
  /** Remplace le chevron (ex. un `Segmented`). */
  trailing?: ReactNode;
  /** Lien : la ligne entière est cliquable. */
  href?: string;
  /** Action : la ligne est un bouton. Sans `href` ni `onClick`, la ligne n'est pas cliquable (le contrôle est dans `trailing`). */
  onClick?: () => void;
};

/** Ligne de réglage : pastille d'icône, titre, résumé, puis chevron ou contrôle. À empiler dans une `ui.card` (`divide-y divide-surface-2`). */
export function SettingsRow({ icon, title, value, trailing, href, onClick }: Props) {
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-brand/10 text-brand [&>svg]:size-5">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {value != null && <span className="block truncate text-sm text-ink-mute">{value}</span>}
      </span>
      {trailing ?? <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />}
    </>
  );
  const cls = "flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left";
  if (href) return <Link href={href} onClick={() => tap()} className={cn(ui.pressCard, cls)}>{body}</Link>;
  if (onClick) return <button type="button" onClick={() => { tap(); onClick(); }} className={cn(ui.pressCard, cls)}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
