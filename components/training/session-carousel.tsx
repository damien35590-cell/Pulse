"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

/** Une pastille : séance du programme course ou séance de muscu de la semaine. */
export type WeekDot = { id: string; title: string; state: "done" | "skipped" | "todo" };
/** Une rangée de pastilles (« Running », « Muscu ») et son compteur (« 2/3 »). */
export type DotRow = { label: string; tone: "run" | "lift"; dots: WeekDot[]; count: string };

const FILL = { run: "bg-brand", lift: "bg-ink/80" } as const;
const RING = { run: "border-brand", lift: "border-ink/80" } as const;

/**
 * Carrousel au doigt de la semaine : la carte s'ouvre sur `start` (aujourd'hui), ce qui est fait à gauche, ce qui vient à droite,
 * course et muscu mêlées dans l'ordre des jours. La diapo suivante dépasse à peine pour suggérer le glissement.
 * Les rangées de pastilles (en bas) servent d'indicateur : celles de la diapo affichée portent un anneau, quel que soit leur état,
 * et toucher une pastille amène le carrousel sur sa diapo.
 */
export function SessionCarousel({ children, slideDots, start = 0, rows, between, footer, className }: {
  children: ReactNode;
  /** Pastilles de chaque diapo, dans l'ordre (une diapo peut en porter plusieurs, ou aucune). */
  slideDots: string[][];
  /** Diapo affichée à l'ouverture (index). */
  start?: number;
  rows: DotRow[];
  /** Contenu entre le carrousel et le pied (ex. invitation au test VMA). */
  between?: ReactNode;
  /** Ligne sous les pastilles : semaine du programme. */
  footer?: ReactNode;
  className?: string;
}) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  const shown = new Set(slideDots[active] ?? []);

  // Ouverture sur la diapo du jour, sans animation.
  useLayoutEffect(() => {
    const el = track.current, slide = el?.children[start] as HTMLElement | undefined;
    if (!el || !slide || start === 0) return;
    el.scrollLeft = slide.offsetLeft - el.offsetLeft - 16;
  }, [start]);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const w = ((el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth) + 12; // + gap-3
    const i = Math.min(slides.length - 1, Math.round(el.scrollLeft / Math.max(1, w)));
    if (i !== active) setActive(i);
  };
  const goTo = (id: string) => {
    const i = slideDots.findIndex((d) => d.includes(id));
    if (i < 0 || i === active) return;
    const el = track.current, slide = el?.children[i] as HTMLElement | undefined;
    if (!el || !slide) return;
    tap();
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft - 16, behavior: "smooth" });
  };

  return (
    <div className={className}>
      <div
        ref={track}
        onScroll={onScroll}
        role="region"
        aria-roledescription="carrousel"
        aria-label="Séances de la semaine"
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="séance"
            aria-label={`${i + 1} sur ${slides.length}`}
            className="w-[calc(100%-8px)] shrink-0 snap-start last:w-full"
          >
            {s}
          </div>
        ))}
      </div>

      {between}

      <div className="mt-4 space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <p className="w-16 shrink-0 text-label uppercase text-ink-mute">{r.label}</p>
            <ol className="-my-2 flex items-center" aria-label={`${r.label} : séances de la semaine`}>
              {r.dots.map((d) => {
                const canGo = slideDots.some((s) => s.includes(d.id)), on = shown.has(d.id);
                const state = d.state === "done" ? "faite" : d.state === "skipped" ? "passée" : "à faire";
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      disabled={!canGo}
                      onClick={() => goTo(d.id)}
                      aria-label={`${d.title} : ${state}${canGo ? ", afficher" : ""}`}
                      aria-current={on || undefined}
                      className="grid size-7 place-items-center rounded-full disabled:cursor-default"
                    >
                      {/* Diapo affichée : anneau clair autour du point, quel que soit son état. */}
                      <span className={cn("size-3 rounded-full transition-[box-shadow,background-color] duration-200",
                        d.state === "done" ? FILL[r.tone] : d.state === "skipped" ? "bg-line" : cn("border-2", on ? RING[r.tone] : "border-line"),
                        on && "ring-2 ring-ink ring-offset-2 ring-offset-surface")} />
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="ml-auto font-num text-sm tabular-nums text-ink-soft">{r.count}</p>
          </div>
        ))}
        {footer && <div className="pt-1">{footer}</div>}
      </div>
    </div>
  );
}
