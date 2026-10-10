"use client";
import dynamic from "next/dynamic";

// Leaflet touche à `window` : chargé uniquement côté navigateur, et seulement sur la fiche d'une sortie.
export const RouteMapLazy = dynamic(() => import("./route-map"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-surface-2" /> });
