"use client";

import { Children, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Carrousel au doigt des séances du programme : la prochaine d'abord, les suivantes en glissant.
 * Chaque diapo laisse dépasser la suivante pour montrer qu'on peut swiper ; les points suivent la position.
 */
export function SessionCarousel({ children, className }: { children: ReactNode; className?: string }) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const w = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth;
    setActive(Math.min(slides.length - 1, Math.round(el.scrollLeft / Math.max(1, w))));
  };
  const goTo = (i: number) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  if (slides.length <= 1) return <div className={className}>{slides}</div>;
  return (
    <div className={className}>
      <div
        ref={track}
        onScroll={onScroll}
        role="region"
        aria-roledescription="carrousel"
        aria-label="Séances à venir"
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain scroll-px-4 px-4"
      >
        {slides.map((s, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="séance"
            aria-label={`${i + 1} sur ${slides.length}`}
            className="w-[88%] shrink-0 snap-start last:w-full"
          >
            {s}
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            onClick={() => goTo(i)}
            className={cn("h-1.5 rounded-full transition-all duration-200", i === active ? "w-4 bg-ink-soft" : "w-1.5 bg-ink-mute/40")}
          />
        ))}
      </div>
    </div>
  );
}
