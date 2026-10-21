"use client";
import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, Globe, Map as MapIcon, Navigation } from "lucide-react";
import type { RoutePoi } from "@/lib/routes/poi";
import { poiTitle } from "@/lib/routes/poi";
import type { PoiDetails } from "@/lib/routes/poi-details";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { PoiIcon } from "./poi-icon";

// Fiches déjà chargées pendant la visite : rouvrir un point est instantané.
const cache = new Map<string, PoiDetails | null>();

/** Fiche d'un point d'intérêt : position sur la boucle, infos OpenStreetMap, résumé Wikipédia, liens. */
export function PoiSheet({ poi, onClose }: { poi: RoutePoi | null; onClose: () => void }) {
  const [details, setDetails] = useState<PoiDetails | null | undefined>(undefined);

  useEffect(() => {
    if (!poi) return;
    if (cache.has(poi.id)) { setDetails(cache.get(poi.id)); return; }
    setDetails(undefined);
    const ctrl = new AbortController();
    fetch(`/api/poi/${poi.id}`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const d = (j?.details as PoiDetails | null) ?? null; cache.set(poi.id, d); setDetails(d); })
      .catch(() => { if (!ctrl.signal.aborted) setDetails(null); });
    return () => ctrl.abort();
  }, [poi?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const name = poi ? details?.name ?? poi.name ?? poiTitle(poi.type) : "";
  const link = cn(ui.btnSecondary, "h-12 w-full bg-surface-3 text-[15px]");
  return (
    <BottomSheet open={!!poi} onClose={onClose} title={name}>
      {poi && (
        <div className="mt-1 space-y-4">
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <PoiIcon type={poi.type} className="size-8 bg-surface-3 [&_svg]:size-4" />
            <span>{poiTitle(poi.type)} · au <span className="font-num tabular-nums text-ink">km {fmtNum(poi.km, 1)}</span> de la boucle</span>
          </p>

          {details === undefined && (
            <div className="space-y-2" aria-hidden>
              <div className="h-4 w-3/4 animate-pulse rounded-full bg-surface-3" />
              <div className="h-4 w-1/2 animate-pulse rounded-full bg-surface-3" />
            </div>
          )}

          {details?.wiki && (
            <div className="overflow-hidden rounded-tile bg-surface-3">
              {details.wiki.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={details.wiki.image} alt="" className="h-40 w-full object-cover" loading="lazy" />
              )}
              <p className="line-clamp-6 p-3 text-sm leading-relaxed text-ink">{details.wiki.extract}</p>
            </div>
          )}
          {details?.description && !details.wiki && <p className="text-sm leading-relaxed text-ink">{details.description}</p>}

          {!!details?.facts.length && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              {details.facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className={ui.label}>{f.label}</dt>
                  <dd className="mt-0.5 text-sm text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {details === null && <p className="text-sm text-ink-soft">OpenStreetMap ne répond pas : pas plus d&apos;infos pour l&apos;instant.</p>}
          {details && !details.wiki && !details.description && !details.facts.length && (
            <p className="text-sm text-ink-soft">Pas d&apos;autre information sur ce lieu dans OpenStreetMap.</p>
          )}

          <div className="grid gap-2">
            {/* geo: ouvre l'appli de carte du téléphone (OsmAnd, Google Maps…). */}
            <a href={`geo:${poi.lat},${poi.lng}?q=${poi.lat},${poi.lng}(${encodeURIComponent(name)})`} className={link}>
              <Navigation className="size-4" aria-hidden />Ouvrir dans mon appli de carte
            </a>
            {details?.wiki && <a href={details.wiki.url} target="_blank" rel="noreferrer" className={link}><BookOpen className="size-4" aria-hidden />Lire sur Wikipédia</a>}
            {details?.website && <a href={details.website} target="_blank" rel="noreferrer" className={link}><Globe className="size-4" aria-hidden />Site web<ExternalLink className="size-3.5 opacity-60" aria-hidden /></a>}
            <a href={details?.osmUrl ?? `https://www.openstreetmap.org/?mlat=${poi.lat}&mlon=${poi.lng}#map=18/${poi.lat}/${poi.lng}`} target="_blank" rel="noreferrer" className={link}>
              <MapIcon className="size-4" aria-hidden />Voir sur OpenStreetMap
            </a>
          </div>
          {details?.wiki && <p className="text-xs text-ink-mute">Texte : Wikipédia (CC BY-SA). Données : © OpenStreetMap.</p>}
        </div>
      )}
    </BottomSheet>
  );
}
