"use client";
import dynamic from "next/dynamic";

// Leaflet touche à `window` : chargé uniquement côté navigateur, et seulement sur la fiche d'une activité (jamais dans le fil).
export const TopoMapLazy = dynamic(() => import("./interactive-topo-map"), { ssr: false, loading: () => <div className="h-[min(60vw,360px)] animate-pulse rounded-card bg-surface-2" /> });
/** Variante plein cadre (tête de fiche) : le chargement remplit le parent, sans arrondi. */
export const TopoMapHeroLazy = dynamic(() => import("./interactive-topo-map"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-surface-2" /> });
