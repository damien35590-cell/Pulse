"use client";
import dynamic from "next/dynamic";

// Leaflet touche à `window` : chargé uniquement côté navigateur, et seulement sur la fiche d'une activité (jamais dans le fil).
// Le chargement a la hauteur de la carte : la page ne saute pas.
export const TopoMapLazy = dynamic(() => import("./interactive-topo-map"), { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-card bg-surface-2" /> });
