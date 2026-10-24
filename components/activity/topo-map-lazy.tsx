"use client";
import dynamic from "next/dynamic";

// Leaflet touche à `window` : chargé uniquement côté navigateur, et seulement sur la fiche d'une activité (jamais dans le fil).
export const TopoMapLazy = dynamic(() => import("./interactive-topo-map"), { ssr: false, loading: () => <div className="h-[min(60vw,360px)] animate-pulse rounded-card bg-surface-2" /> });
