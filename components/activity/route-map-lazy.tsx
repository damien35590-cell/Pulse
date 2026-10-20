"use client";
import dynamic from "next/dynamic";

// Leaflet touche à `window` : chargé uniquement côté navigateur, et seulement sur la fiche d'une sortie.
export const RouteMapLazy = dynamic(() => import("./route-map"), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-surface-2" /> });

/** Même carte, dont le squelette remplit le cadre donné par le parent (vignettes, carte plein écran). */
export const RouteMapFill = dynamic(() => import("./route-map"), { ssr: false, loading: () => <div className="size-full animate-pulse bg-surface-2" /> });
