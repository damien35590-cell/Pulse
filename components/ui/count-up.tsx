"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 800;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const STORAGE_PREFIX = "pulse:count-up:";

// sessionStorage peut être indisponible (navigation privée, quota) : on n'en dépend jamais.
const seen = (key: string) => { try { return sessionStorage.getItem(STORAGE_PREFIX + key) != null; } catch { return false; } };
const markSeen = (key: string) => { try { sessionStorage.setItem(STORAGE_PREFIX + key, "1"); } catch { /* ignoré */ } };

type Props = {
  /** Valeur finale (le nombre sous-jacent, pas le texte). */
  value: number;
  /** Rend le nombre animé dans son vrai format : allure, durée, décimales… Par défaut : entier. */
  format?: (n: number) => string;
  /** Si fourni, l'animation ne se joue qu'une fois par session pour cette clé (ex. `activity:<id>:Distance`). */
  storageKey?: string;
  className?: string;
};

/**
 * Compte de 0 à `value` en ~800 ms (ease-out cubic, requestAnimationFrame).
 * Le rendu serveur et le premier rendu affichent la valeur finale ; l'animation démarre au montage.
 * Sans animation si `prefers-reduced-motion`, ou si la clé a déjà été jouée pendant la session.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), storageKey, className }: Props) {
  const [shown, setShown] = useState(value);
  const final = format(value);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (storageKey && seen(storageKey)) return;
    let raf = 0, start = 0;
    const tick = (now: number) => {
      start ||= now;
      const t = Math.min(1, (now - start) / DURATION_MS);
      setShown(value * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (storageKey) markSeen(storageKey); // à la fin seulement : le double montage du mode strict rejoue sinon dans le vide
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `format` change d'identité à chaque rendu parent : seule la valeur relance l'animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, storageKey]);

  return (
    <span aria-label={final} className={cn("font-num tabular-nums", className)}>
      <span aria-hidden>{shown === value ? final : format(shown)}</span>
    </span>
  );
}

type Parsed = { value: number; format: (n: number) => string };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Retrouve le nombre et le format d'un affichage déjà formaté (« 4:43 », « 1:02:03 », « 25,9 », « 1 234 », « 152 »).
 * Les pages serveur ne peuvent pas passer de fonction à un composant client : le texte final suffit à reconstruire les deux.
 * null si le texte n'est pas un simple nombre (« +3 », « – ») : il s'affiche alors tel quel.
 */
export function parseDisplay(text: string): Parsed | null {
  const clock = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(text);
  if (clock) {
    const [, a, b, c] = clock;
    if (c == null) {
      const total = Number(a) * 60 + Number(b);
      return { value: total, format: (n) => { const r = Math.round(n); return `${Math.floor(r / 60)}:${pad(r % 60)}`; } };
    }
    const total = Number(a) * 3600 + Number(b) * 60 + Number(c);
    return {
      value: total,
      format: (n) => { const r = Math.round(n); return `${Math.floor(r / 3600)}:${pad(Math.floor((r % 3600) / 60))}:${pad(r % 60)}`; },
    };
  }
  const decimal = /^(\d+),(\d+)$/.exec(text);
  if (decimal) {
    const d = decimal[2].length;
    return { value: Number(`${decimal[1]}.${decimal[2]}`), format: (n) => n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }) };
  }
  if (/^\d+$/.test(text)) return { value: Number(text), format: (n) => String(Math.round(n)) };
  if (/^\d{1,3}(?:[\s  ]\d{3})+$/.test(text)) {
    return { value: Number(text.replace(/\D/g, "")), format: (n) => Math.round(n).toLocaleString("fr-FR") };
  }
  return null;
}

/** CountUp à partir d'un texte déjà formaté (voir parseDisplay) ; texte brut s'il n'est pas animable. */
export function CountUpText({ text, storageKey, className }: { text: string; storageKey?: string; className?: string }) {
  const parsed = parseDisplay(text);
  if (!parsed) return <span className={className}>{text}</span>;
  return <CountUp value={parsed.value} format={parsed.format} storageKey={storageKey} className={className} />;
}
