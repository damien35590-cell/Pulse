"use client";
import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASEMAP_CREDITS } from "@/lib/map/basemap";

/**
 * Attribution compacte des cartes : un petit « i » replié, une ligne unique une fois touché (retoucher ou toucher ailleurs referme).
 * À poser dans le conteneur `relative` de la carte ; l'attribution Leaflet par défaut est désactivée.
 * `inLink` : la carte est dans un lien (fil) → pas de <a> imbriqué, les crédits ouvrent leur page via window.open.
 * `defaultOpen` : état initial (démo /ui-kit).
 */
export function MapAttribution({ inLink, className, defaultOpen = false }: { inLink?: boolean; className?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);

  // Le toucher ne doit ni ouvrir l'activité (lien du fil) ni déplacer la carte.
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  return (
    <div
      ref={box}
      onClick={(e) => { stop(e); if (inLink) e.preventDefault(); }}
      onPointerDown={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      onDoubleClick={stop}
      className={cn("absolute bottom-1.5 right-1.5 z-[1000] flex items-center justify-end", className)}
    >
      {open ? (
        <div onClick={() => setOpen(false)} className="flex items-center whitespace-nowrap rounded-full bg-surface/80 px-2 py-0.5 text-micro text-ink-soft backdrop-blur">
          {BASEMAP_CREDITS.map((c, i) => (
            <span key={c.label} className={cn(i > 0 && "ml-1.5")}>
              ©{" "}
              {inLink ? (
                <span role="link" tabIndex={0} className="cursor-pointer" onClick={() => window.open(c.href, "_blank", "noopener,noreferrer")}>{c.label}</span>
              ) : (
                <a href={c.href} target="_blank" rel="noopener noreferrer">{c.label}</a>
              )}
            </span>
          ))}
        </div>
      ) : (
        <button
          type="button"
          aria-label="Crédits de la carte"
          aria-expanded={false}
          onClick={() => setOpen(true)}
          className="-m-1.5 grid size-8 touch-manipulation place-items-center"
        >
          <span className="grid size-5 place-items-center rounded-full bg-surface/80 text-ink-soft backdrop-blur"><Info className="size-3.5" aria-hidden /></span>
        </button>
      )}
    </div>
  );
}
