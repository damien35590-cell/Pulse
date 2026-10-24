"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";

type Props = {
  title: string;
  subtitle?: React.ReactNode;
  /** Lien de retour, ou action (ex. revenir à l'étape précédente). */
  back?: string | (() => void);
  backLabel?: string;
  actions?: React.ReactNode;
  /** Grand titre sous la barre, qui se replie dans la barre au défilement (comme les apps natives). */
  large?: boolean;
  /** Le titre est affiché ailleurs dans la page (ex. fiche d'activité) : il n'apparaît dans la barre qu'une fois cet élément passé sous elle. Remplace `large`. */
  collapseAt?: React.RefObject<HTMLElement>;
  /** Barre transparente posée sur un visuel plein cadre (carte) tant que `collapseAt` est sous elle, avec un léger dégradé pour la lisibilité. */
  overlay?: boolean;
};

const backCls =
  "grid size-12 place-items-center rounded-full text-ink select-none touch-manipulation transition duration-150 ease-snappy active:scale-90 active:bg-surface-2";

/** En-tête collant : safe area du haut, fond flouté une fois la page défilée, grand titre repliable. */
export function TopBar({ title, subtitle, back, backLabel = "Retour", actions, large = true, collapseAt, overlay = false }: Props) {
  const heading = large && !collapseAt;
  const [compact, setCompact] = useState(!heading && !collapseAt);
  const bar = useRef<HTMLElement>(null);
  const probe = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = collapseAt ? collapseAt.current : heading ? probe.current : null;
    if (!target || !bar.current) return;
    const h = bar.current.offsetHeight; // hauteur réelle, safe area comprise
    // Replié seulement si l'élément est passé AU-DESSUS de la barre (pas s'il est encore plus bas dans la page).
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting && e.boundingClientRect.top < h), { rootMargin: `-${h}px 0px 0px 0px` });
    io.observe(target);
    return () => io.disconnect();
  }, [heading, collapseAt]);

  const floating = overlay && !compact;
  const showTitle = heading || !!collapseAt;

  return (
    <>
      <header
        ref={bar}
        className={cn(
          // -mt annule la marge haute de la coque : la barre démarre au bord de l'écran, safe area à l'intérieur.
          "sticky top-0 z-30 -mx-4 -mt-[calc(1rem_+_env(safe-area-inset-top))] px-1 pt-safe-top transition-[background-color,box-shadow] duration-200",
          compact ? "bg-bg/85 shadow-[0_1px_0_0_rgb(var(--line))] backdrop-blur-xl backdrop-saturate-150" : floating ? "bg-transparent" : "bg-bg",
        )}
      >
        {overlay && (
          <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 top-0 h-[calc(100%_+_2rem)] bg-gradient-to-b from-bg/80 via-bg/40 to-transparent transition-opacity duration-200", floating ? "opacity-100" : "opacity-0")} />
        )}
        <div className="relative flex h-14 items-center gap-1">
          {typeof back === "string" ? (
            <Link href={back} onPointerDown={() => tap(6)} aria-label={backLabel} className={backCls}>
              <ChevronLeft className="size-7" strokeWidth={2.2} aria-hidden />
            </Link>
          ) : back ? (
            <button type="button" onPointerDown={() => tap(6)} onClick={back} aria-label={backLabel} className={backCls}>
              <ChevronLeft className="size-7" strokeWidth={2.2} aria-hidden />
            </button>
          ) : (
            <span className="w-3" aria-hidden />
          )}
          {showTitle ? (
            <p aria-hidden className={cn("min-w-0 flex-1 truncate text-[17px] font-semibold transition duration-200 first-letter:uppercase", compact ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0")}>
              {title}
            </p>
          ) : (
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold first-letter:uppercase">{title}</h1>
          )}
          {actions ? <div className="flex shrink-0 items-center pr-1">{actions}</div> : <span className="w-3" aria-hidden />}
        </div>
      </header>
      {heading && (
        <div ref={probe} className="pb-5 pt-1">
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight text-ink first-letter:uppercase">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-soft">{subtitle}</p>}
        </div>
      )}
    </>
  );
}
