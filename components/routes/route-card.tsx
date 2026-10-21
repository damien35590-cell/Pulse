"use client";
import { useMemo } from "react";
import Link from "next/link";
import { CloudSun, Sparkles } from "lucide-react";
import type { RouteView } from "@/lib/data/routes";
import { decodePolyline } from "@/lib/polyline";
import { durationMetric, sportLine } from "@/lib/routes/view";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { Metric } from "@/components/ui/metric";
import { RouteMapFill } from "@/components/activity/route-map-lazy";
import { WeatherAlerts } from "./weather";

/**
 * Boucle proposée : nom, 3 chiffres (temps, km, D+), vignette de carte figée, une phrase « pourquoi ».
 * `onSelect` : mode démo (/ui-kit), sans navigation.
 */
export function RouteCard({ r, onSelect, meta }: { r: RouteView; onSelect?: () => void; meta?: string }) {
  const points = useMemo(() => decodePolyline(r.polyline), [r.polyline]);
  const t = durationMetric(r.estMinutes);
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-lg font-semibold leading-tight text-ink">{r.label}</p>
        <p className="shrink-0 text-xs text-ink-mute">{meta ?? sportLine(r)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Metric size="lg" label="Temps" value={t.value} unit={t.unit} />
        <Metric size="lg" label="Distance" value={fmtNum(r.distanceM / 1000, 1)} unit="km" />
        <Metric size="lg" label="D+" value={fmtNum(r.ascentM, 0)} unit="m" />
      </dl>
      <div className="mt-4 h-36 overflow-hidden rounded-tile">
        <RouteMapFill points={points} interactive={false} className="h-full rounded-none" />
      </div>
      <p className="mt-3 flex gap-2 text-[13px] leading-snug text-ink-soft">
        <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" aria-hidden />
        <span className="line-clamp-2">{r.why}</span>
      </p>
      {r.weather && (
        <>
          <p className="mt-1.5 flex gap-2 text-[13px] leading-snug text-ink-soft">
            <CloudSun className="mt-0.5 size-3.5 shrink-0 text-ink-mute" aria-hidden />
            <span className="line-clamp-2">{r.weather.line}</span>
          </p>
          <WeatherAlerts alerts={r.weather.alerts} max={2} className="mt-2" />
        </>
      )}
    </>
  );
  const cls = cn(ui.card, ui.pressCard, "block w-full p-4 text-left");
  if (onSelect)
    return (
      <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }} className={cn(cls, "cursor-pointer")}>
        {body}
      </div>
    );
  return <Link href={`/itineraires/${r.id}`} onPointerDown={() => tap(6)} className={cls}>{body}</Link>;
}

/** Squelette pendant la recherche : même silhouette que la carte. */
export function RouteCardSkeleton() {
  return (
    <div className={cn(ui.card, "p-4")} aria-hidden>
      <div className="h-5 w-32 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-11 animate-pulse rounded-tile bg-surface-2" />)}
      </div>
      <div className="mt-4 h-36 animate-pulse rounded-tile bg-surface-2" />
      <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-surface-2" />
    </div>
  );
}
