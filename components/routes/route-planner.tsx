"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { House, LocateFixed, MapPin, Route } from "lucide-react";
import type { RouteView } from "@/lib/data/routes";
import { fmtPaceMin } from "@/lib/routes/estimate";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { setHome } from "@/app/actions";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { NumberStepper } from "@/components/ui/number-stepper";
import { RouteCard, RouteCardSkeleton } from "./route-card";

type Sport = "RUN" | "RIDE";
type Variant = "road" | "trail";
type LatLng = { lat: number; lng: number };
type Props = {
  home: LatLng | null;
  run: { paceSKm: number; samples: number };
  ride: { speedKmh: number; samples: number };
};

const PRESETS = [30, 45, 60, 90, 120] as const;
const WAIT = ["Pulse trace une vingtaine de boucles…", "Recherche des forêts, rivières et points de vue…", "Comparaison des boucles…", "OpenStreetMap prend son temps, encore un instant…"];
const STORE = "pulse:itineraires"; // dernière recherche : retrouvée au retour d'une fiche

type Saved = { sport: Sport; variant: Variant; minutes: number; custom: boolean; routes: RouteView[]; note?: string };
const load = (): Saved | null => { try { return JSON.parse(sessionStorage.getItem(STORE) ?? "null"); } catch { return null; } };
const store = (s: Saved) => { try { sessionStorage.setItem(STORE, JSON.stringify(s)); } catch { /* stockage indisponible */ } };

/** Une seule lecture GPS (pas de suivi) : Pulse prépare la boucle, la navigation se fait dans OsmAnd ou sur la Garmin. */
function readPosition(): Promise<GeolocationPosition> {
  return new Promise((ok, ko) => {
    if (!("geolocation" in navigator)) return ko(new Error("La localisation n'est pas disponible sur cet appareil."));
    navigator.geolocation.getCurrentPosition(ok, (e) => ko(new Error(e.code === e.PERMISSION_DENIED ? "Autorise la localisation pour Pulse dans les réglages du navigateur." : "Position introuvable. Réessaie à l'extérieur.")), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
  });
}

export function RoutePlanner({ home: initialHome, run, ride }: Props) {
  const [sport, setSport] = useState<Sport>("RUN");
  const [variant, setVariant] = useState<Variant>("road");
  const [minutes, setMinutes] = useState(60);
  const [custom, setCustom] = useState(false);
  const [home, setHomeState] = useState(initialHome);
  const [mode, setMode] = useState<"home" | "here">(initialHome ? "home" : "here");
  const [here, setHere] = useState<(LatLng & { acc: number }) | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteView[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);
  const [saving, startSaving] = useTransition();
  const results = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = load();
    if (!s) return;
    setSport(s.sport); setVariant(s.variant); setMinutes(s.minutes); setCustom(s.custom); setRoutes(s.routes); setNote(s.note ?? null);
  }, []);

  useEffect(() => {
    if (!loading) return;
    setWait(0);
    const id = setInterval(() => setWait((w) => Math.min(WAIT.length - 1, w + 1)), 6000);
    return () => clearInterval(id);
  }, [loading]);

  const start = mode === "home" ? home : here;

  async function locate(saveAsHome = false) {
    setGeoError(null); setLocating(true);
    try {
      const p = await readPosition();
      const pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
      if (saveAsHome) saveHome(pos); else setHere(pos);
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : "Position introuvable.");
    } finally {
      setLocating(false);
    }
  }

  function saveHome(pos: LatLng) {
    startSaving(async () => {
      const r = await setHome(pos.lat, pos.lng);
      if (r.ok) { setHomeState({ lat: pos.lat, lng: pos.lng }); setMode("home"); tap(10); }
    });
  }

  async function search() {
    if (!start || loading) return;
    tap(10);
    setLoading(true); setError(null); setNote(null); setRoutes(null);
    requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const res = await fetch("/api/routes/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, variant: sport === "RIDE" ? variant : undefined, minutes, start: { lat: start.lat, lng: start.lng } }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.routes) throw new Error(j?.error ?? (res.status === 504 ? "La recherche a pris trop de temps. Réessaie : la zone sera en cache." : "La recherche a échoué."));
      setRoutes(j.routes); setNote(j.note ?? null);
      store({ sport, variant, minutes, custom, routes: j.routes, note: j.note });
    } catch (e) {
      setError(e instanceof Error ? e.message : "La recherche a échoué.");
    } finally {
      setLoading(false);
    }
  }

  const hint = sport === "RUN"
    ? `Allure ${fmtPaceMin(run.paceSKm)}/km ${run.samples ? `(médiane de tes ${run.samples} sorties sur 90 jours)` : "(valeur par défaut, pas assez de sorties récentes)"}`
    : `${fmtNum(ride.speedKmh, 1)} km/h ${ride.samples ? `(médiane de tes ${ride.samples} sorties sur 90 jours)` : "(valeur par défaut)"}${variant === "trail" ? ", un peu moins sur chemins" : ""}`;

  return (
    <div className="space-y-8">
      <Section title="Sport">
        <div className="space-y-2">
          <Segmented options={[{ value: "RUN", label: "Course" }, { value: "RIDE", label: "Vélo" }]} value={sport} onChange={setSport} />
          {sport === "RIDE" && <Segmented size="sm" options={[{ value: "road", label: "Route" }, { value: "trail", label: "Chemins" }]} value={variant} onChange={setVariant} />}
          <p className="px-1 text-xs text-ink-mute">{hint}</p>
        </div>
      </Section>

      <Section title="Temps dispo">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Temps disponible">
          {PRESETS.map((m) => (
            <Chip key={m} active={!custom && minutes === m} onClick={() => { setCustom(false); setMinutes(m); }}>
              <span className="flex items-baseline gap-1"><span className="font-num text-metric-sm tabular-nums">{m}</span><span className="text-xs opacity-70">min</span></span>
            </Chip>
          ))}
          <Chip active={custom} onClick={() => setCustom(true)}>Autre</Chip>
        </div>
        {custom && <NumberStepper label="Durée" unit="minutes" value={minutes} onChange={setMinutes} step={5} min={15} max={300} />}
      </Section>

      <Section title="Départ">
        <div className="space-y-3">
          <Segmented options={[{ value: "home", label: "Domicile" }, { value: "here", label: "Ma position" }]} value={mode} onChange={setMode} />
          {mode === "home" ? (
            home ? (
              <div className={cn(ui.card, "flex items-center gap-3 p-4")}>
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink"><House className="size-5" aria-hidden /></span>
                <p className="min-w-0 flex-1 text-sm text-ink-soft">Départ et arrivée à la maison</p>
                <button type="button" onClick={() => locate(true)} disabled={locating || saving} className="h-12 shrink-0 touch-manipulation px-2 text-sm font-semibold text-brand active:opacity-60 disabled:opacity-40">
                  {locating || saving ? "…" : "Mettre à jour"}
                </button>
              </div>
            ) : (
              <div className={cn(ui.card, "space-y-3 p-4")}>
                <p className="text-sm text-ink-soft">Pas encore de domicile. Lance la recherche depuis chez toi pour l&apos;enregistrer d&apos;un geste.</p>
                <button type="button" onClick={() => locate(true)} disabled={locating || saving} className={cn(ui.btnSecondary, "w-full")}>
                  <House className="size-5" aria-hidden />{locating || saving ? "Localisation…" : "Ma position actuelle = domicile"}
                </button>
              </div>
            )
          ) : (
            <div className={cn(ui.card, "space-y-3 p-4")}>
              {here && (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <MapPin className="size-4 shrink-0 text-brand" aria-hidden />
                  <span>Position relevée · précision ± <span className="font-num tabular-nums">{here.acc}</span> m</span>
                </p>
              )}
              <button type="button" onClick={() => locate()} disabled={locating} className={cn(ui.btnSecondary, "w-full")}>
                <LocateFixed className="size-5" aria-hidden />{locating ? "Localisation…" : here ? "Relever à nouveau" : "Utiliser ma position actuelle"}
              </button>
              {here && (
                <button type="button" onClick={() => saveHome(here)} disabled={saving} className="h-12 w-full touch-manipulation text-sm font-semibold text-brand active:opacity-60 disabled:opacity-40">
                  {saving ? "Enregistrement…" : "En faire mon domicile"}
                </button>
              )}
            </div>
          )}
          {geoError && <p role="alert" className="px-1 text-sm text-bad">{geoError}</p>}
        </div>
      </Section>

      <div ref={results} className="scroll-mt-20 empty:hidden">
        {loading && (
          <Section title="Recherche en cours">
            <p className="px-1 text-sm text-ink-soft" aria-live="polite">{WAIT[wait]} <span className="text-ink-mute">(environ 10 s)</span></p>
            {[0, 1, 2].map((i) => <RouteCardSkeleton key={i} />)}
          </Section>
        )}
        {!loading && error && (
          <div role="alert" className={cn(ui.card, "space-y-1 p-4")}>
            <p className="font-semibold text-bad">Pas de boucle cette fois</p>
            <p className="text-sm text-ink-soft">{error}</p>
          </div>
        )}
        {!loading && routes && (
          <Section title={`${routes.length} boucle${routes.length > 1 ? "s" : ""} pour ${minutes} min`}>
            {note && <p className="px-1 text-sm text-ink-soft">{note}</p>}
            <div className="space-y-3">{routes.map((r) => <RouteCard key={r.id} r={r} />)}</div>
          </Section>
        )}
      </div>

      {/* Action principale dans la zone du pouce, au-dessus de la barre de navigation. */}
      <div className="h-16" aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(theme(spacing.nav)_+_0.75rem)] z-30 mx-auto max-w-md px-4">
        <button type="button" onClick={search} disabled={!start || loading} className={cn(ui.btnPrimary, "pointer-events-auto w-full")}>
          <Route className="size-5" aria-hidden />
          {loading ? "Recherche…" : start ? "Trouver 3 boucles" : "Choisis un départ"}
        </button>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={() => { if (!active) { tap(6); onClick(); } }}
      className={cn(
        "flex h-12 items-center justify-center rounded-full text-sm font-semibold select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.97]",
        active ? "bg-ink text-bg" : "bg-surface-2 text-ink active:bg-surface-3",
      )}
    >
      {children}
    </button>
  );
}
