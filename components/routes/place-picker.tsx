"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { History, MapPin, Search, X } from "lucide-react";
import type { Place } from "@/lib/routes/places";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";

const PickMap = dynamic(() => import("./pick-map"), { ssr: false, loading: () => <div className="h-48 animate-pulse rounded-tile bg-surface-2" /> });

type LatLng = { lat: number; lng: number };
const RECENT = "pulse:lieux"; // derniers départs choisis, sur ce téléphone
const RECENT_MAX = 5;
const SEARCH_DEBOUNCE_MS = 350;

const loadRecent = (): Place[] => { try { return JSON.parse(localStorage.getItem(RECENT) ?? "[]"); } catch { return []; } };
const saveRecent = (p: Place) => {
  try { localStorage.setItem(RECENT, JSON.stringify([p, ...loadRecent().filter((x) => x.id !== p.id && x.name !== p.name)].slice(0, RECENT_MAX))); } catch { /* stockage indisponible */ }
};

/**
 * Départ ailleurs qu'au domicile ou à la position actuelle : recherche d'un lieu (IGN + Photon / OpenStreetMap)
 * ou toucher sur la carte, puis ajustement du point d'un autre toucher.
 */
export function PlacePicker({ near, value, onChange }: { near: LatLng | null; value: Place | null; onChange: (p: Place) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<Place[]>([]);
  const tapSeq = useRef(0);

  useEffect(() => setRecent(loadRecent()), []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) { setResults(null); setSearching(false); setFailed(false); return; }
    const ctrl = new AbortController();
    setSearching(true);
    const id = setTimeout(async () => {
      const s = new URLSearchParams({ q: text });
      if (near) { s.set("lat", String(near.lat)); s.set("lng", String(near.lng)); }
      try {
        const j = await fetch(`/api/places?${s}`, { signal: ctrl.signal }).then((r) => r.json());
        setResults(j?.places ?? []); setFailed(j?.places == null);
      } catch {
        if (!ctrl.signal.aborted) { setResults([]); setFailed(true); }
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (p: Place) => {
    tap(8);
    onChange(p); saveRecent(p); setRecent(loadRecent());
    setQ(""); setResults(null);
  };

  // Toucher sur la carte : le point est pris tel quel, son nom arrive ensuite (le dernier toucher gagne).
  const pickOnMap = async (ll: LatLng) => {
    const seq = ++tapSeq.current, id = `pt:${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;
    onChange({ id, name: "Point choisi sur la carte", detail: "", ...ll });
    setQ(""); setResults(null);
    try {
      const j = await fetch(`/api/places?lat=${ll.lat}&lng=${ll.lng}`).then((r) => r.json());
      const found = j?.places?.[0] as Place | undefined;
      if (seq !== tapSeq.current || !found) return;
      const p = { id, name: `Près de ${found.name}`, detail: found.detail, ...ll };
      onChange(p); saveRecent(p); setRecent(loadRecent());
    } catch { /* le point reste sans nom */ }
  };

  const list = results ?? (q.trim().length < 3 ? recent : null);
  return (
    <div className={cn(ui.card, "space-y-3 p-4")}>
      <label className="relative block">
        <span className="sr-only">Chercher un lieu de départ</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-mute" aria-hidden />
        <input
          type="search" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Ville, adresse, parking, forêt…"
          className="h-12 w-full rounded-full bg-surface-2 pl-12 pr-12 text-[15px] text-ink outline-none placeholder:text-ink-mute focus-visible:ring-2 focus-visible:ring-brand [&::-webkit-search-cancel-button]:hidden"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} aria-label="Effacer" className={cn(ui.iconBtn, "absolute right-0 top-0")}>
            <X className="size-5 text-ink-soft" aria-hidden />
          </button>
        )}
      </label>

      {searching && !results && <p className="px-1 text-sm text-ink-mute" aria-live="polite">Recherche…</p>}
      {failed && <p className="px-1 text-sm text-ink-soft">La recherche de lieux ne répond pas : touche la carte pour placer le départ.</p>}
      {results && !results.length && !failed && <p className="px-1 text-sm text-ink-soft">Aucun lieu trouvé. Essaie le nom de la commune, ou touche la carte pour placer le départ.</p>}
      {list && list.length > 0 && (
        <div>
          {!results && <p className={cn(ui.label, "px-1")}>Récents</p>}
          <ul className="divide-y divide-line">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => choose(p)} className="flex min-h-12 w-full touch-manipulation items-center gap-3 py-2 text-left active:opacity-60">
                  {results ? <MapPin className="size-4 shrink-0 text-ink-mute" aria-hidden /> : <History className="size-4 shrink-0 text-ink-mute" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                    {(p.detail || p.km != null) && (
                      <span className="block truncate text-xs text-ink-mute">{[p.detail, results && p.km != null && `à ${p.km < 10 ? p.km.toLocaleString("fr-FR") : Math.round(p.km)} km`].filter(Boolean).join(" · ")}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {value && (
        <p className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 shrink-0 text-brand" aria-hidden />
          <span className="min-w-0 flex-1 truncate"><span className="font-semibold text-ink">{value.name}</span>{value.detail && <span className="text-ink-mute"> · {value.detail}</span>}</span>
        </p>
      )}
      <PickMap center={near} value={value} onPick={pickOnMap} />
      <p className="px-1 text-xs text-ink-mute">{value ? "Touche la carte pour ajuster le point de départ." : "Ou touche la carte pour placer le départ."} Recherche : IGN Géoplateforme et Photon (OpenStreetMap).</p>
    </div>
  );
}
