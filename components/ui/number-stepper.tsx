"use client";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  /** Affichage de la valeur (ex. 0 → « PDC » pour un exercice au poids du corps). */
  format?: (v: number) => string;
  className?: string;
};

const fr = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const parse = (s: string) => {
  const n = Number(s.replace(",", ".").replace(/[^\d.]/g, ""));
  return s.trim() !== "" && Number.isFinite(n) ? n : null;
};

const btn =
  "grid size-14 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink select-none touch-manipulation transition duration-100 active:scale-90 active:bg-surface-3 aria-disabled:opacity-30";

/**
 * −  valeur  +  pour la saisie en pleine séance.
 * Appui long = répétition accélérée ; tap sur la valeur = clavier numérique (virgule acceptée). Boutons de 56 px.
 */
export function NumberStepper({ label, value, onChange, step = 1, min = 0, max = 9999, unit, format = fr, className }: Props) {
  const [draft, setDraft] = useState<string | null>(null); // null = pas en cours de frappe
  const current = useRef(value);
  current.current = value;
  const hold = useRef<{ wait?: ReturnType<typeof setTimeout>; rep?: ReturnType<typeof setInterval> }>({});

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  const stop = () => { clearTimeout(hold.current.wait); clearInterval(hold.current.rep); };
  const bump = (dir: 1 | -1) => {
    const next = clamp(current.current + dir * step);
    if (next === current.current) return stop(); // butée atteinte : on arrête la répétition
    current.current = next;
    onChange(next);
  };
  useEffect(() => stop, []);

  // Tap simple : la valeur change au « click », que le navigateur annule si le doigt part en défilement
  // (pas de +2 kg fantôme en faisant défiler la page). Appui maintenu 400 ms : répétition rapide.
  const held = useRef(false);
  const handlers = (dir: 1 | -1) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      held.current = false;
      stop();
      hold.current.wait = setTimeout(() => {
        held.current = true;
        tap(12);
        bump(dir);
        hold.current.rep = setInterval(() => bump(dir), 75);
      }, 400);
    },
    onPointerUp: stop,
    onPointerCancel: stop, // le doigt part en défilement : on arrête
    onPointerLeave: stop,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (held.current) { held.current = false; return; } // la répétition a déjà compté
      tap(8);
      bump(dir);
    },
  });

  const commit = () => {
    if (draft == null) return;
    const n = parse(draft);
    if (n != null) onChange(clamp(n));
    setDraft(null);
  };

  return (
    <div className={cn("flex items-center gap-2 rounded-tile bg-surface p-2 shadow-card", className)}>
      <button type="button" aria-label={`${label} : moins ${fr(step)}`} aria-disabled={value <= min} className={btn} {...handlers(-1)}>
        <Minus className="size-6" strokeWidth={2.5} aria-hidden />
      </button>
      <label className="flex min-w-0 flex-1 flex-col items-center">
        <span className="text-label uppercase text-ink-mute">{label}</span>
        <input
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          aria-label={label}
          value={draft ?? format(value)}
          onFocus={(e) => { setDraft(fr(value)); const el = e.currentTarget; requestAnimationFrame(() => el.select()); }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
          className="w-full min-w-0 bg-transparent text-center font-num text-metric-xl tabular-nums text-ink caret-brand outline-none"
        />
        {unit && <span className="text-xs font-medium text-ink-soft">{unit}</span>}
      </label>
      <button type="button" aria-label={`${label} : plus ${fr(step)}`} aria-disabled={value >= max} className={btn} {...handlers(1)}>
        <Plus className="size-6" strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}
