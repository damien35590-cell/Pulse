import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Retire les doublons d'une liste d'objets ayant un `id` (garde la première occurrence). */
export function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => !seen.has(x.id) && !!seen.add(x.id));
}

/**
 * tailwind-merge doit connaître les tailles de texte et espacements du thème :
 * sans ça, cn("text-metric-lg text-ink") renvoie "text-ink" (la taille est prise pour une couleur et supprimée).
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: { spacing: ["safe-top", "safe-bottom", "nav"] },
    classGroups: {
      "font-size": [{ text: ["label", "metric-sm", "metric-md", "metric-lg", "metric-xl", "metric-hero"] }],
      rounded: [{ rounded: ["tile", "card", "sheet"] }],
      "rounded-t": [{ "rounded-t": ["sheet"] }],
      "rounded-b": [{ "rounded-b": ["card"] }],
      shadow: [{ shadow: ["card", "pop", "glow"] }],
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
