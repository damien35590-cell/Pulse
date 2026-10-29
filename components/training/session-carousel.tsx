"use client";

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

type Dot = { id: string; title: string; status: string };

/**
 * Carrousel au doigt des séances du programme : la carte s'ouvre sur `start` (le jour), les séances passées de la semaine à gauche,
 * les suivantes à droite.
 * La séance suivante dépasse à peine (≈ 12 px) pour suggérer le swipe.
 * Les points de la semaine (en bas à droite) servent aussi d'indicateur : celui de la séance affichée porte l'anneau,
 * et toucher un point à faire amène le carrousel sur cette séance.
 */
export function SessionCarousel({ children, slideIds, start = 0, week, between, footer, count, className }: {
  children: ReactNode;
  /** Id de la séance de chaque diapo, dans l'ordre. */
  slideIds: string[];
  /** Diapo affichée à l'ouverture (index). */
  start?: number;
  /** Séances de la semaine en cours (points). */
  week: Dot[];
  /** Contenu entre le carrousel et le pied (ex. invitation au test VMA). */
  between?: ReactNode;
  /** Pied à gauche : semaine du programme, encouragement. */
  footer: ReactNode;
  /** « 1/3 » */
  count: string;
  className?: string;
}) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(start);
  const shownId = slideIds[active];

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
    const i = slideIds.indexOf(id);
    if (i === active) return;
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
        aria-label="Séances du programme"
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

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">{footer}</div>
        <div className="flex shrink-0 items-center gap-2">
          <ol className="-my-2 flex items-center" aria-label="Séances de la semaine">
            {week.map((s) => {
              const canGo = slideIds.includes(s.id), shown = s.id === shownId;
              const state = s.status === "COMPLETED" ? "faite" : s.status === "SKIPPED" ? "passée" : "à faire";
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!canGo}
                    onClick={() => goTo(s.id)}
                    aria-label={`${s.title} : ${state}${canGo ? ", afficher" : ""}`}
                    aria-current={shown || undefined}
                    className="grid size-7 place-items-center rounded-full disabled:cursor-default"
                  >
                    <span className={cn("size-3 rounded-full transition-colors duration-200",
                      s.status === "COMPLETED" ? "bg-brand" : s.status === "SKIPPED" ? "bg-line" : shown ? "border-2 border-brand" : "border-2 border-line")} />
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="font-num text-sm tabular-nums text-ink-soft">{count}</p>
        </div>
      </div>
    </div>
  );
}
