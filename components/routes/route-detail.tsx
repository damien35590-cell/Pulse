"use client";
import { useMemo, useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, CloudSun, Share2, Shirt, Sparkles } from "lucide-react";
import type { RouteView } from "@/lib/data/routes";
import { decodePolyline } from "@/lib/polyline";
import { gpxFileName, toGpx } from "@/lib/routes/gpx";
import { poiTitle } from "@/lib/routes/poi";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { setRouteSaved } from "@/app/actions";
import { Section } from "@/components/ui/section";
import { Metric } from "@/components/ui/metric";
import { TraceChart } from "@/components/activity/trace-chart";
import { RouteMapFill } from "@/components/activity/route-map-lazy";
import { durationMetric } from "@/lib/routes/view";
import { PoiIcon } from "./poi-icon";
import { WeatherAlerts, WeatherCredit } from "./weather";

const startLabel = (ms: number) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(ms));

const R = 6_371_000, rad = Math.PI / 180;
const dist = ([a, b]: [number, number], [c, d]: [number, number]) =>
  2 * R * Math.asin(Math.sqrt(Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2));

/** Altitude ré-échantillonnée à pas de distance constant : la courbe se lit en km, pas en points GPS. */
function profile(points: [number, number][], ele: number[], n = 200) {
  if (points.length < 2 || ele.length !== points.length) return null;
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + dist(points[i - 1], points[i]));
  const total = cum.at(-1)!, out: number[] = [];
  let j = 0;
  for (let k = 0; k < n; k++) {
    const d = (total * k) / (n - 1);
    while (j < cum.length - 2 && cum[j + 1] < d) j++;
    const t = cum[j + 1] > cum[j] ? (d - cum[j]) / (cum[j + 1] - cum[j]) : 0;
    out.push(ele[j] + t * (ele[j + 1] - ele[j]));
  }
  return { values: out, km: total / 1000 };
}

type ShareResult = "shared" | "downloaded" | "cancelled";

/** Partage du GPX (OsmAnd, Garmin Connect…) si le téléphone sait partager ce fichier, sinon téléchargement. */
async function shareGpx(r: RouteView, points: [number, number][]): Promise<ShareResult> {
  const km = r.distanceM / 1000, name = gpxFileName(r.label, km);
  const gpx = toGpx({ name: `${r.label} · ${fmtNum(km, 1)} km`, points, elevation: r.elevation, pois: r.pois });
  const file = new File([gpx], name, { type: "application/gpx+xml" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return "shared"; }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(file), a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}

export function RouteDetail({ r }: { r: RouteView }) {
  const points = useMemo(() => decodePolyline(r.polyline), [r.polyline]);
  const alt = useMemo(() => profile(points, r.elevation), [points, r.elevation]);
  const [saved, setSaved] = useState(r.saved);
  const [pending, start] = useTransition();
  const [shared, setShared] = useState<ShareResult | null>(null);
  const t = durationMetric(r.estMinutes);

  const toggle = () => {
    const next = !saved;
    tap(next ? 12 : 6);
    setSaved(next); // affichage immédiat, annulé si l'enregistrement échoue
    start(async () => { const res = await setRouteSaved(r.id, next).catch(() => null); if (!res?.ok) setSaved(!next); });
  };

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="h-[48dvh] min-h-72 overflow-hidden rounded-card">
          <RouteMapFill points={points} pois={r.pois} expandable className="h-full rounded-none" />
        </div>
        <dl className="grid grid-cols-3 gap-3 px-1">
          <Metric size="xl" label="Temps estimé" value={t.value} unit={t.unit} />
          <Metric size="xl" label="Distance" value={fmtNum(r.distanceM / 1000, 1)} unit="km" />
          <Metric size="xl" label="D+" value={fmtNum(r.ascentM, 0)} unit="m" />
        </dl>
        <p className="flex gap-2 px-1 text-[15px] leading-snug text-ink-soft">
          <Sparkles className="mt-1 size-4 shrink-0 text-brand" aria-hidden />
          <span>{r.why}</span>
        </p>
      </div>

      {r.weather && (
        <Section title="Météo" action={<span className="text-xs text-ink-mute">départ {startLabel(r.weather.startAt)}</span>}>
          <div className={cn(ui.card, "space-y-3 p-4")}>
            <p className="flex gap-2 text-[15px] leading-snug text-ink">
              <CloudSun className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
              <span>{r.weather.line}</span>
            </p>
            <WeatherAlerts alerts={r.weather.alerts} />
            <div className="flex gap-2 border-t border-line pt-3">
              <Shirt className="mt-0.5 size-4 shrink-0 text-ink-soft" aria-hidden />
              <div className="min-w-0">
                <p className={ui.label}>Conseil tenue</p>
                <p className="mt-0.5 text-sm text-ink-soft">{r.weather.outfit}</p>
              </div>
            </div>
            {r.weather.reversed && <p className="text-xs text-ink-mute">Boucle parcourue dans le sens qui met le vent de face à l&apos;aller.</p>}
          </div>
          <WeatherCredit className="px-1" />
        </Section>
      )}

      {alt && (
        <Section title="Altitude" action={<span className="font-num text-sm tabular-nums text-ink-mute">{fmtNum(r.ascentM, 0)} m D+</span>}>
          <div className={cn(ui.card, "p-4")}>
            <TraceChart
              values={alt.values} unit="m" label="Altitude le long de la boucle" area
              format={(v) => fmtNum(v, 0)}
              at={(f) => `km ${fmtNum(f * alt.km, 1)}`}
              ticks={[0, 0.25, 0.5, 0.75, 1].map((f) => fmtNum(f * alt.km, f === 0 ? 0 : 1))}
            />
          </div>
        </Section>
      )}

      <Section title="Sur le parcours" action={<span className="font-num text-sm tabular-nums text-ink-mute">{r.pois.length}</span>}>
        {r.pois.length ? (
          <ul className={cn(ui.card, "divide-y divide-line px-4")}>
            {r.pois.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <PoiIcon type={p.type} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{p.name ?? poiTitle(p.type)}</p>
                  {p.name && <p className="truncate text-xs text-ink-mute">{poiTitle(p.type)}</p>}
                </div>
                <p className="shrink-0 font-num text-metric-sm tabular-nums text-ink">
                  <span className="mr-1 font-sans text-xs font-medium text-ink-soft">km</span>{fmtNum(p.km, 1)}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>Aucun point d&apos;intérêt cartographié à moins de 75 m du tracé.</p>
        )}
      </Section>

      <p className="px-1 text-xs text-ink-mute">
        Pulse prépare la boucle, sans navigation en direct : ouvre le GPX dans OsmAnd ou importe-le dans Garmin Connect pour être guidé.
        {shared === "downloaded" && " Fichier téléchargé : ouvre-le depuis tes téléchargements."}
      </p>

      <div className="h-16" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(theme(spacing.nav)_+_0.75rem)] z-30 mx-auto grid max-w-md grid-cols-[1fr_auto] gap-2 px-4">
        <button type="button" onClick={async () => { tap(10); setShared(await shareGpx(r, points)); }} className={cn(ui.btnPrimary, "pointer-events-auto")}>
          <Share2 className="size-5" aria-hidden />Partager le GPX
        </button>
        <button type="button" onClick={toggle} disabled={pending} aria-pressed={saved} className={cn(ui.btnSecondary, "pointer-events-auto shadow-pop", saved && "text-brand")}>
          {saved ? <BookmarkCheck className="size-5" aria-hidden /> : <Bookmark className="size-5" aria-hidden />}
          {saved ? "Gardée" : "Garder"}
        </button>
      </div>
    </div>
  );
}
