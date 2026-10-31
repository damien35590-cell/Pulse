"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const DURATION_MS = 650;
const FROM = 0.7; // on se pose sur la valeur au lieu de compter depuis zéro
const RISE_PX = 6;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const STORAGE_PREFIX = "pulse:count-up:";
// useLayoutEffect côté client : la décision (jouer ou non) tombe avant la première peinture. Sur le serveur, useEffect évite l'avertissement.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// sessionStorage peut être indisponible (navigation privée, quota) : on n'en dépend jamais.
const seen = (key: string) => { try { return sessionStorage.getItem(STORAGE_PREFIX + key) != null; } catch { return false; } };
const markSeen = (key: string) => { try { sessionStorage.setItem(STORAGE_PREFIX + key, "1"); } catch { /* ignoré */ } };

export type CountUpMode = "count" | "fade";

type Props = {
  /** Valeur finale (le nombre sous-jacent, pas le texte). */
  value: number;
  /** Rend le nombre animé dans son vrai format : allure, durée, décimales… Par défaut : entier. */
  format?: (n: number) => string;
  /** « count » : se pose de 70 % à 100 % de la valeur. « fade » : apparition seule, sans compter (allures). */
  mode?: CountUpMode;
  /** Retard avant le départ, en ms (échelonnement : 70 ms par rang, voir Metric). */
  delay?: number;
  /** Si fourni, l'animation ne se joue qu'une fois par session pour cette clé (ex. `activity:<id>:Distance`). */
  storageKey?: string;
  className?: string;
};

/**
 * Chiffre qui se pose : de 70 % à 100 % de la valeur, avec fondu et montée de 6 px (650 ms, ease-out cubic ; transform et opacité seulement).
 * Le texte final est rendu invisible dans la même cellule de grille : la largeur est réservée, l'unité voisine ne bouge pas.
 * Tant que l'animation n'a pas démarré le chiffre est transparent (pas de flash final → 0 → final) ; sans animation
 * (`prefers-reduced-motion`, clé déjà jouée dans la session) il apparaît tel quel, sans transition. aria-label = valeur finale.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), mode = "count", delay = 0, storageKey, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = format(value);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("count-up-pending"); // le JS a la main : le filet CSS (globals.css) ne doit plus intervenir
    el.textContent = final;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || (storageKey && seen(storageKey))) {
      el.style.opacity = "1";
      el.style.transform = "";
      return;
    }
    let raf = 0, start = 0;
    const draw = (e: number) => {
      el.style.opacity = String(e);
      el.style.transform = e < 1 ? `translateY(${(1 - e) * RISE_PX}px)` : "";
      el.textContent = mode === "count" && e < 1 ? format(value * (FROM + (1 - FROM) * e)) : final;
    };
    draw(0);
    const tick = (now: number) => {
      start ||= now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / DURATION_MS));
      draw(easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else if (storageKey) markSeen(storageKey); // à la fin seulement : le double montage du mode strict rejoue sinon dans le vide
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `format` change d'identité à chaque rendu parent : seuls la valeur et le texte final relancent l'animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [final, mode, delay, storageKey]);

  return (
    <span aria-label={final} className={cn("inline-grid font-num tabular-nums", className)}>
      <span aria-hidden className="invisible col-start-1 row-start-1">{final}</span>
      <span ref={ref} aria-hidden className="count-up-pending col-start-1 row-start-1" style={{ opacity: 0 }}>{final}</span>
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
export function CountUpText({ text, mode, delay, storageKey, className }: { text: string; mode?: CountUpMode; delay?: number; storageKey?: string; className?: string }) {
  const parsed = parseDisplay(text);
  if (!parsed) return <span className={className}>{text}</span>;
  return <CountUp value={parsed.value} format={parsed.format} mode={mode} delay={delay} storageKey={storageKey} className={className} />;
}
