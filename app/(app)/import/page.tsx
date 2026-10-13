"use client";

import { useState } from "react";
import Link from "next/link";
import { importFiles } from "@/lib/import";
import { buildStream } from "@/lib/stream";
import type { ParsedActivity } from "@/lib/import/types";

const fmtTime = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}`;
/** Allège les traces (≤ 600 points) pour rester sous la limite de taille des requêtes. */
const slim = (a: ParsedActivity): ParsedActivity => { const stream = buildStream(a.points) ?? undefined, step = Math.max(1, Math.ceil(a.points.length / 600)); return { ...a, stream, points: a.points.filter((_, i) => i % step === 0 || i === a.points.length - 1) }; };

export default function ImportPage() {
  const [items, setItems] = useState<ParsedActivity[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ saved: number; duplicates: number; invalid: number; backfilled: number } | null>(null);
  const [failed, setFailed] = useState(false);
  
  // États pour les synchronisations
  const [sync, setSync] = useState<{ busy: boolean; msg?: string; err?: string }>({ busy: false });
  const [syncFit, setSyncFit] = useState<{ busy: boolean; msg?: string; err?: string }>({ busy: false });

  async function syncNow() {
    setSync({ busy: true, msg: undefined, err: undefined });
    try {
      const r = await fetch("/api/sync/intervals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 7 }) });
      const j = await r.json();
      if (!r.ok) return setSync({ busy: false, err: j.error ?? "Échec de la synchronisation" });
      setSync({ busy: false, msg: j.found === 0 ? "Aucune activité trouvée sur Intervals.icu ces 7 derniers jours." : `${j.saved} nouvelle(s) sortie(s) enregistrée(s), ${j.duplicates} déjà présente(s)${j.backfilled ? `, ${j.backfilled} complétée(s) avec le détail` : ""}${j.skipped ? `, ${j.skipped} sans fichier (ignorée${j.skipped > 1 ? "s" : ""})` : ""}.${j.errors?.length ? ` ${j.errors.length} erreur(s).` : ""}` });
    } catch { setSync({ busy: false, err: "Connexion impossible, réessayez." }); }
  }

  async function syncFitNow() {
    setSyncFit({ busy: true, msg: undefined, err: undefined });
    try {
      const r = await fetch("/api/sync/google-fit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: 7 }) });
      const j = await r.json();
      if (!r.ok) return setSyncFit({ busy: false, err: j.error ?? "Échec de la synchronisation Google Fit" });
      setSyncFit({ busy: false, msg: j.count === 0 ? "Aucune activité trouvée sur Google Fit ces 7 derniers jours." : j.message });
    } catch { setSyncFit({ busy: false, err: "Connexion impossible, réessayez." }); }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true); setResult(null); setFailed(false);
    try { const r = await importFiles(files); setItems(r.activities); setErrors(r.errors); } catch { setErrors(["Fichier illisible."]); setItems([]); }
    setBusy(false);
  }

  async function save() {
    setBusy(true); setFailed(false); const tot = { saved: 0, duplicates: 0, invalid: 0, backfilled: 0 };
    try {
      for (let i = 0; i < items.length; i += 5) {
        setProgress({ done: i, total: items.length });
        const r = await fetch("/api/activities/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activities: items.slice(i, i + 5).map(slim) }) });
        if (!r.ok) throw new Error("http");
        const j = await r.json(); tot.saved += j.saved; tot.duplicates += j.duplicates; tot.invalid += j.invalid; tot.backfilled += j.backfilled ?? 0;
      }
      setResult(tot); setItems([]);
    } catch { setFailed(true); }
    setProgress(null); setBusy(false);
  }

  return (
    <section className="space-y-5">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <h1 className="font-display text-3xl font-bold leading-none">Importer</h1>
      <p className="text-ink-soft">Fichiers FIT ou GPX (Strava, MyWhoosh, votre montre), ou l’archive ZIP exportée de Strava. Les sorties déjà présentes sont ignorées.</p>

      {/* Bloc Google Fit */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="font-bold">Synchroniser depuis Google Fit</p>
        <p className="mt-1 text-sm text-ink-soft">Récupère vos activités physiques (vélo, course, etc.) des 7 derniers jours.</p>
        <button onClick={syncFitNow} disabled={syncFit.busy} className="mt-3 min-h-12 w-full rounded-xl border border-brand bg-transparent font-display text-lg font-semibold text-brand disabled:opacity-60">{syncFit.busy ? "Synchronisation…" : "Synchroniser Google Fit"}</button>
        {syncFit.msg && <p role="status" className="mt-2 text-sm">{syncFit.msg}</p>}
        {syncFit.err && <p role="alert" className="mt-2 text-sm font-medium text-brand">{syncFit.err}</p>}
      </div>

      {/* Bloc Intervals.icu */}
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="font-bold">Synchroniser depuis Intervals.icu</p>
        <p className="mt-1 text-sm text-ink-soft">Récupère vos sorties MyWhoosh des 7 derniers jours. Pulse le fait aussi chaque nuit, tout seul.</p>
        <button onClick={syncNow} disabled={sync.busy} className="mt-3 min-h-12 w-full rounded-xl bg-brand font-display text-lg font-semibold text-brand-ink disabled:opacity-60">{sync.busy ? "Synchronisation…" : "Synchroniser Intervals"}</button>
        {sync.msg && <p role="status" className="mt-2 text-sm">{sync.msg}</p>}
        {sync.err && <p role="alert" className="mt-2 text-sm font-medium text-brand">{sync.err}</p>}
      </div>

      <label className="grid min-h-14 cursor-pointer place-items-center rounded-xl bg-brand px-4 font-display text-xl font-semibold text-brand-ink active:scale-[.98]">
        {busy && !progress ? "Lecture en cours…" : "Choisir des fichiers"}
        <input type="file" multiple accept=".fit,.gpx,.zip,.gz" onChange={onPick} className="sr-only" disabled={busy} />
      </label>

      {errors.length > 0 && <ul className="space-y-1 rounded-xl border border-line bg-surface p-3 text-sm text-ink-soft">{errors.slice(0, 5).map((m) => <li key={m}>{m}</li>)}{errors.length > 5 && <li>… et {errors.length - 5} autres</li>}</ul>}

      {result && (
        <div role="status" className="rounded-xl border border-line bg-surface p-4">
          <p className="font-display text-2xl font-bold">{result.saved} sortie{result.saved > 1 ? "s" : ""} enregistrée{result.saved > 1 ? "s" : ""}</p>
          <p className="mt-1 text-sm text-ink-soft">{result.backfilled > 0 ? `${result.backfilled} séance${result.backfilled > 1 ? "s" : ""} complétée${result.backfilled > 1 ? "s" : ""} avec le détail (puissance, cardio). ` : ""}{result.duplicates > 0 ? `${result.duplicates} déjà présente${result.duplicates > 1 ? "s" : ""}, ignorée${result.duplicates > 1 ? "s" : ""}. ` : ""}{result.invalid > 0 ? `${result.invalid} illisible${result.invalid > 1 ? "s" : ""}.` : ""}</p>
          <Link href="/activities" className="mt-3 grid min-h-12 place-items-center rounded-xl bg-surface-2 font-semibold">Voir mes activités</Link>
        </div>
      )}
      {failed && <p role="alert" className="text-sm font-medium text-brand">L’enregistrement a échoué. Vérifiez votre connexion et réessayez : les sorties déjà enregistrées ne seront pas dupliquées.</p>}

      {items.length > 0 && (
        <>
          <p className="font-semibold">{items.length} activité{items.length > 1 ? "s" : ""} prête{items.length > 1 ? "s" : ""}</p>
          <button onClick={save} disabled={busy} className="min-h-14 w-full rounded-xl bg-ink font-display text-xl font-semibold text-bg disabled:opacity-60">
            {progress ? `Enregistrement… ${Math.min(progress.done, progress.total)} / ${progress.total}` : `Enregistrer ${items.length} activité${items.length > 1 ? "s" : ""}`}
          </button>
          <ul className="space-y-2">
            {items.slice(0, 50).map((a) => (
              <li key={a.dedupeKey} className="flex items-center justify-between rounded-xl border border-line bg-surface p-4">
                <div><div className="font-semibold">{a.title}</div><div className="text-sm text-ink-soft">{new Date(a.startedAt).toLocaleDateString("fr-FR")}</div></div>
                <div className="text-right"><div className="font-display text-2xl font-bold">{(a.distanceM / 1000).toFixed(1).replace(".", ",")} km</div><div className="text-sm text-ink-soft">{fmtTime(a.movingTimeS)}</div></div>
              </li>
            ))}
            {items.length > 50 && <li className="text-center text-sm text-ink-soft">… et {items.length - 50} autres</li>}
          </ul>
        </>
      )}
    </section>
  );
}