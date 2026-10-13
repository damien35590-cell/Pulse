"use client";
import dynamic from "next/dynamic";

// Leaflet touche à `window` : chargé uniquement côté navigateur.
export const TopoMapLazy = dynamic(() => import("./interactive-topo-map"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-surface-2" /> });
