"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { StoryReveal } from "@/components/record/story-reveal";

const FEELINGS = [["GREAT", "Super"], ["GOOD", "Bien"], ["OK", "Correct"], ["TIRED", "Fatigué"], ["HARD", "Difficile"]] as const;
const SPORT_KEYS = ["RUN", "RIDE", "HIKE", "WORKOUT"] as const;
const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const field = "mt-1 min-h-14 w-full rounded-xl border border-line bg-surface px-4 font-display text-2xl font-bold tabular-nums";

export default function RecordPage() {
  const router = useRouter();
  const [type, setType] = useState<(typeof SPORT_KEYS)[number]>("RUN");
  const [f, setF] = useState({ title: "", when: localNow(), km: "", h: "", min: "", elev: "", notes: "" });
  const [feeling, setFeeling] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [res, setRes] = useState<{ story: string; record: boolean; id: string } | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const movingTimeS = num(f.h) * 3600 + num(f.min) * 60;
    if (movingTimeS <= 0) return setErr("Indiquez la durée de la sortie.");
    setBusy(true); setErr("");
    const hour = new Date(f.when).getHours();
    const title = f.title.trim() || `${SPORTS[type].label} ${hour < 12 ? "du matin" : hour < 18 ? "de l’après-midi" : "du soir"}`;
    const r = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      type, title, startedAt: new Date(f.when).toISOString(), distanceM: num(f.km) * 1000, movingTimeS, elevationGainM: num(f.elev), feeling, notes: f.notes || null }) });
    setBusy(false);
    if (!r.ok) return setErr("Impossible d’enregistrer. Vérifiez votre connexion et réessayez.");
    const j = await r.json(); setRes({ story: j.story, record: j.record, id: j.id });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="font-display text-3xl font-bold leading-none">Nouvelle sortie</h1>
      <div role="radiogroup" aria-label="Sport" className="grid grid-cols-2 gap-2">
        {SPORT_KEYS.map((k) => { const I = SPORTS[k].icon, on = type === k; return (
          <button type="button" key={k} role="radio" aria-checked={on} onClick={() => { tap(); setType(k); }}
            className={cn("flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold", on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface")}>
            <I className="h-6 w-6" aria-hidden />{SPORTS[k].label}
          </button>); })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-ink-soft">Distance (km)<input inputMode="decimal" value={f.km} onChange={set("km")} placeholder="0" className={field} /></label>
        <label className="text-sm text-ink-soft">Dénivelé + (m)<input inputMode="numeric" value={f.elev} onChange={set("elev")} placeholder="0" className={field} /></label>
        <label className="text-sm text-ink-soft">Heures<input inputMode="numeric" value={f.h} onChange={set("h")} placeholder="0" className={field} /></label>
        <label className="text-sm text-ink-soft">Minutes<input inputMode="numeric" value={f.min} onChange={set("min")} placeholder="0" className={field} /></label>
      </div>
      <label className="block text-sm text-ink-soft">Début<input type="datetime-local" value={f.when} onChange={set("when")} className={cn(field, "text-lg font-semibold")} /></label>
      <label className="block text-sm text-ink-soft">Titre (facultatif)<input value={f.title} onChange={set("title")} className={cn(field, "text-lg font-semibold")} /></label>
      <div role="radiogroup" aria-label="Ressenti" className="flex flex-wrap gap-2">
        {FEELINGS.map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={feeling === k} onClick={() => { tap(); setFeeling(feeling === k ? null : k); }} className={cn("min-h-12 rounded-full px-4 font-medium", feeling === k ? "bg-brand text-brand-ink" : "bg-surface-2")}>{l}</button>)}
      </div>
      <label className="block text-sm text-ink-soft">Notes<textarea value={f.notes} onChange={set("notes")} rows={3} className="mt-1 w-full rounded-xl border border-line bg-surface p-4 text-base" /></label>
      {err && <p role="alert" className="text-sm font-medium text-brand">{err}</p>}
      <button disabled={busy} className="min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer la sortie"}</button>
      <p className="text-center text-sm text-ink-soft">Vous avez un fichier GPX ou FIT ? <Link href="/import" className="font-semibold text-brand">Importez-le</Link></p>
      {res && <StoryReveal story={res.story} record={res.record} onClose={() => { router.push(`/activities/${res.id}`); router.refresh(); }} />}
    </form>
  );
}
