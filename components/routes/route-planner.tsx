"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { House, LocateFixed, MapPin, Route } from "lucide-react";
import type { RouteView } from "@/lib/data/routes";
import type { RideWeather } from "@/lib/weather/open-meteo";
import type { Place } from "@/lib/routes/places";
import { fmtPaceMin } from "@/lib/routes/estimate";
import { RUN_SESSIONS, SESSION_LABEL, type RunSession } from "@/lib/routes/session-fit";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { setHome } from "@/app/actions";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { NumberStepper } from "@/components/ui/number-stepper";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { RouteCard, RouteCardSkeleton } from "./route-card";
import { WeatherBanner, WeatherCredit } from "./weather";
import { PlacePicker } from "./place-picker";

type Sport = "RUN" | "RIDE";
type Variant = "road" | "trail";
type LatLng = { lat: number; lng: number };
type When = "now" | "1h" | "pick";
type Pick = { day: "today" | "tomorrow"; time: string }; // time : « HH:MM », heure du téléphone
type Habit = "habit" | "balanced" | "discover";
type HabitSummary = { traces: number; classics: number; junctions: number } | null;
type Props = {
  home: LatLng | null;
  habits: { RUN: HabitSummary; RIDE: HabitSummary };
  run: { paceSKm: number; samples: number };
  ride: { speedKmh: number; samples: number };
  /** Recherche pré-remplie (lien du coach du jour) : remplace la dernière recherche gardée. */
  preset?: { sport: Sport; minutes: number; session?: RunSession } | null;
  /** Sections de la page affichées sous les résultats, avant l'espace réservé au bouton du bas. */
  children?: React.ReactNode;
};

const PRESETS = [30, 45, 60, 90, 120] as const;
const WAIT = ["Pulse trace une vingtaine de boucles…", "Recherche des forêts, rivières et points de vue…", "Comparaison des boucles…", "OpenStreetMap prend son temps, encore un instant…"];
const WEATHER_DEBOUNCE_MS = 400;
const STORE = "pulse:itineraires"; // dernière recherche : retrouvée au retour d'une fiche

type Mode = "home" | "here" | "place";
type Saved = {
  sport: Sport; variant: Variant; minutes: number; custom: boolean; routes: RouteView[]; note?: string;
  /** Départ choisi : retrouvé au retour d'une fiche (sinon « Choisis un départ » alors que les boucles sont là). */
  mode?: Mode; here?: (LatLng & { acc: number }) | null; place?: Place | null; habit?: Habit; session?: RunSession;
};
const load = (): Saved | null => { try { return JSON.parse(sessionStorage.getItem(STORE) ?? "null"); } catch { return null; } };
const store = (s: Saved) => { try { sessionStorage.setItem(STORE, JSON.stringify(s)); } catch { /* stockage indisponible */ } };

/** Heure choisie → instant (ms), dans le fuseau du téléphone. */
function pickAt(p: Pick) {
  const [h, m] = p.time.split(":").map(Number), d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (p.day === "tomorrow" ? 1 : 0), h, m).getTime();
}

/** Départ en ISO (undefined = maintenant, décidé par le serveur). */
function startISO(when: When, pick: Pick) {
  if (when === "now") return undefined;
  return new Date(when === "1h" ? Date.now() + 36e5 : pickAt(pick)).toISOString();
}

const pickLabel = (p: Pick) => `${p.day === "today" ? "Auj." : "Demain"} ${p.time}`;

/** Une seule lecture GPS (pas de suivi) : Pulse prépare la boucle, la navigation se fait dans OsmAnd ou sur la Garmin. */
function readPosition(): Promise<GeolocationPosition> {
  return new Promise((ok, ko) => {
    if (!("geolocation" in navigator)) return ko(new Error("La localisation n'est pas disponible sur cet appareil."));
    navigator.geolocation.getCurrentPosition(ok, (e) => ko(new Error(e.code === e.PERMISSION_DENIED ? "Autorise la localisation pour Pulse dans les réglages du navigateur." : "Position introuvable. Réessaie à l'extérieur.")), { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 });
  });
}

const SESSION_HINT: Record<RunSession, string> = {
  normal: "Boucles classées comme d'habitude : nature, curiosités, équilibre.",
  intervals: "Une ligne droite plate d'au moins 400 m (1 km idéalement), hors grandes routes, pour tes répétitions.",
  long: "Des points d'eau sur le parcours (fontaines, cimetières) ; plus de 75 min sans eau est pénalisé.",
  easy: "Du plat et de la nature (parcs, forêts, chemins), le moins de routes fréquentées possible.",
};

const HABIT_HINT: Record<Habit, string> = {
  habit: "Tes chemins connus d'abord, et ton classique adapté à ton temps.",
  balanced: "Un mélange : ton classique s'il tient dans ce temps, puis des boucles variées.",
  discover: "Des chemins où tu n'es jamais passé autour de ton départ.",
};

export function RoutePlanner({ home: initialHome, run, ride, habits, preset, children }: Props) {
  const [sport, setSport] = useState<Sport>("RUN");
  const [variant, setVariant] = useState<Variant>("road");
  const [minutes, setMinutes] = useState(60);
  const [custom, setCustom] = useState(false);
  const [habit, setHabit] = useState<Habit>("balanced");
  const [session, setSession] = useState<RunSession>("normal");
  /** Séance reprise du lien du coach (programme) : signalée sous le sélecteur. */
  const [fromPlan, setFromPlan] = useState(false);
  const [home, setHomeState] = useState(initialHome);
  const [mode, setMode] = useState<Mode>(initialHome ? "home" : "here");
  const [here, setHere] = useState<(LatLng & { acc: number }) | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [routes, setRoutes] = useState<RouteView[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(0);
  const [saving, startSaving] = useTransition();
  const [when, setWhen] = useState<When>("now");
  const [pick, setPick] = useState<Pick>({ day: "today", time: "18:00" });
  const [picking, setPicking] = useState(false);
  const [weather, setWeather] = useState<RideWeather | null | undefined>(undefined);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const results = useRef<HTMLDivElement>(null);
  const departure = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preset) {
      setSport(preset.sport); setMinutes(preset.minutes); setCustom(!(PRESETS as readonly number[]).includes(preset.minutes));
      setSession(preset.session ?? "normal"); setFromPlan(!!preset.session && preset.session !== "normal");
      return;
    }
    const s = load();
    if (!s) return;
    setSport(s.sport); setVariant(s.variant); setMinutes(s.minutes); setCustom(s.custom); setRoutes(s.routes); setNote(s.note ?? null);
    if (s.habit) setHabit(s.habit);
    if (s.session) setSession(s.session);
    if (s.mode === "place" && s.place) { setPlace(s.place); setMode("place"); }
    else if (s.mode === "here" && s.here) { setHere(s.here); setMode("here"); }
    else if (s.mode === "home" && initialHome) setMode("home");
  }, []);

  useEffect(() => {
    if (!loading) return;
    setWait(0);
    const id = setInterval(() => setWait((w) => Math.min(WAIT.length - 1, w + 1)), 6000);
    return () => clearInterval(id);
  }, [loading]);

  const start = mode === "home" ? home : mode === "here" ? here : place;
  const pickPast = when === "pick" && pickAt(pick) < Date.now() - 30 * 6e4;

  // Bandeau météo : rechargé quand le départ, l'heure ou la durée changent (le serveur garde la prévision 30 min).
  useEffect(() => {
    if (!start || pickPast) { setWeather(undefined); return; }
    const ctrl = new AbortController();
    setWeatherLoading(true);
    const id = setTimeout(async () => {
      const q = new URLSearchParams({ lat: String(start.lat), lng: String(start.lng), minutes: String(minutes) });
      const iso = startISO(when, pick);
      if (iso) q.set("start", iso);
      try {
        const r = await fetch(`/api/weather?${q}`, { signal: ctrl.signal });
        const j = await r.json().catch(() => null);
        setWeather(r.ok ? j?.weather ?? null : null);
      } catch {
        if (!ctrl.signal.aborted) setWeather(null);
      } finally {
        if (!ctrl.signal.aborted) setWeatherLoading(false);
      }
    }, WEATHER_DEBOUNCE_MS);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [start?.lat, start?.lng, minutes, when, pick, pickPast]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!start || loading || pickPast) return;
    tap(10);
    setLoading(true); setError(null); setNote(null); setRoutes(null);
    requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    try {
      const res = await fetch("/api/routes/suggest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport, variant: sport === "RIDE" ? variant : undefined, minutes, start: { lat: start.lat, lng: start.lng }, startISO: startISO(when, pick), habit,
          session: sport === "RUN" ? session : undefined,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.routes) throw new Error(j?.error ?? (res.status === 504 ? "La recherche a pris trop de temps. Réessaie : la zone sera en cache." : "La recherche a échoué."));
      setRoutes(j.routes); setNote(j.note ?? null);
      if (j.weather !== undefined) setWeather(j.weather);
      store({ sport, variant, minutes, custom, routes: j.routes, note: j.note, mode, here, place, habit, session });
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

      {sport === "RUN" && (
        <Section title="Séance">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type de séance">
              {RUN_SESSIONS.map((s) => (
                <Chip key={s} active={session === s} onClick={() => { setSession(s); setFromPlan(false); }}>{SESSION_LABEL[s]}</Chip>
              ))}
            </div>
            <p className="px-1 text-xs text-ink-mute">
              {fromPlan && <span className="font-semibold text-ink-soft">D&apos;après ta séance du programme. </span>}
              {SESSION_HINT[session]}
            </p>
          </div>
        </Section>
      )}

      <Section title="Style">
        <div className="space-y-2">
          <Segmented options={[{ value: "habit", label: "Habitude" }, { value: "balanced", label: "Équilibre" }, { value: "discover", label: "Découverte" }]} value={habit} onChange={setHabit} />
          <p className="px-1 text-xs text-ink-mute">
            {habits[sport]?.traces
              ? `${HABIT_HINT[habit]} D'après tes ${habits[sport]!.traces} sorties avec GPS${habits[sport]!.classics ? `, ${habits[sport]!.classics} classique${habits[sport]!.classics > 1 ? "s" : ""}` : ""}.`
              : "Pulse ne connaît pas encore tes chemins : récupère tes traces GPS dans Mes habitudes."}
          </p>
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

      <Section title="Heure de départ">
        <div className="space-y-2">
          <Segmented
            options={[{ value: "now", label: "Maintenant" }, { value: "1h", label: "Dans 1 h" }, { value: "pick", label: when === "pick" ? pickLabel(pick) : "Choisir" }]}
            value={when}
            onChange={(v) => (v === "pick" ? setPicking(true) : setWhen(v))}
          />
          {when === "pick" && (
            <button type="button" onClick={() => setPicking(true)} className="flex h-12 w-full touch-manipulation items-center justify-between px-1 text-sm active:opacity-60">
              <span className={pickPast ? "text-bad" : "text-ink-soft"}>{pickPast ? "Cette heure est passée" : `Départ ${pick.day === "today" ? "aujourd'hui" : "demain"} à ${pick.time}`}</span>
              <span className="font-semibold text-brand">Modifier</span>
            </button>
          )}
          <WeatherCredit className="px-1" />
        </div>
      </Section>

      <StartSheet open={picking} value={pick} onClose={() => setPicking(false)} onPick={(p) => { setPick(p); setWhen("pick"); setPicking(false); }} />

      <div ref={departure} className="scroll-mt-20">
      <Section title="Départ">
        <div className="space-y-3">
          <Segmented options={[{ value: "home", label: "Domicile" }, { value: "here", label: "Ma position" }, { value: "place", label: "Autre lieu" }]} value={mode} onChange={setMode} />
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
          ) : mode === "place" ? (
            <PlacePicker near={home ?? here} value={place} onChange={setPlace} />
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
      </div>

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

      {children}

      {/* Action principale dans la zone du pouce, au-dessus de la barre de navigation, sur un fond qui masque ce qui défile dessous. */}
      <div className={start && !pickPast ? "h-40" : "h-24"} aria-hidden />
      <div className="pointer-events-none fixed inset-x-0 bottom-nav z-30 mx-auto max-w-md bg-gradient-to-t from-bg from-60% to-transparent px-4 pb-3 pt-6">
        <div className="space-y-2">
          {start && !pickPast && <WeatherBanner w={weather} loading={weatherLoading} />}
          {start ? (
            <button type="button" onClick={search} disabled={loading || pickPast} className={cn(ui.btnPrimary, "pointer-events-auto w-full")}>
              <Route className="size-5" aria-hidden />
              {loading ? "Recherche…" : pickPast ? "Choisis une heure à venir" : "Trouver 3 boucles"}
            </button>
          ) : (
            // Pas encore de départ : le bouton mène à la section Départ au lieu de rester grisé.
            <button
              type="button"
              onClick={() => { tap(6); departure.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
              className={cn(ui.btnSecondary, "pointer-events-auto w-full shadow-pop")}
            >
              <MapPin className="size-5" aria-hidden />Choisis un départ
            </button>
          )}
        </div>
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

/** Choix de l'heure de départ : aujourd'hui ou demain, au quart d'heure. */
function StartSheet({ open, value, onClose, onPick }: { open: boolean; value: Pick; onClose: () => void; onPick: (p: Pick) => void }) {
  const [draft, setDraft] = useState(value);
  // Heure déjà passée : on propose l'heure pleine suivante.
  useEffect(() => {
    if (!open) return;
    const next = new Date(Date.now() + 36e5);
    setDraft(pickAt(value) >= Date.now() ? value : { day: next.getDate() === new Date().getDate() ? "today" : "tomorrow", time: `${String(next.getHours()).padStart(2, "0")}:00` });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const past = !draft.time || pickAt(draft) < Date.now() - 30 * 6e4;
  return (
    <BottomSheet open={open} onClose={onClose} title="Heure de départ">
      <div className="mt-4 space-y-3">
        <Segmented options={[{ value: "today", label: "Aujourd'hui" }, { value: "tomorrow", label: "Demain" }]} value={draft.day} onChange={(day) => setDraft({ ...draft, day })} className="bg-surface-3" />
        <label className="block">
          <span className={ui.label}>Heure</span>
          <input
            type="time" step={900} value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            className="mt-1 h-14 w-full rounded-tile bg-surface-3 px-4 font-num text-metric-md tabular-nums text-ink outline-none focus-visible:ring-2 focus-visible:ring-brand"
          />
        </label>
        {past && draft.time && <p className="px-1 text-sm text-bad">Cette heure est passée : choisis plus tard ou demain.</p>}
        <button type="button" disabled={past} onClick={() => { tap(10); onPick(draft); }} className={cn(ui.btnPrimary, "w-full")}>Valider</button>
      </div>
    </BottomSheet>
  );
}
