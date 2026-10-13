import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Retire les doublons d'une liste d'objets ayant un `id` (garde la première occurrence). */
export function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((x) => !seen.has(x.id) && !!seen.add(x.id));
}

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
