"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { StoryReveal } from "@/components/record/story-reveal";

const FEELINGS = [["GREAT", "Super"], ["GOOD", "Bien"], ["OK", "Correct"], ["TIRED", "Fatigué"], ["HARD", "Difficile"]] as const;
const SPORT_KEYS = ["RUN", "RIDE", "HIKE", "WORKOUT"] as const;
type Ex = { id: number; name: string; sets: string; reps: string; loadKg: string; restS: string; comment: string };
const blank = (id: number): Ex => ({ id, name: "", sets: "3", reps: "10", loadKg: "", restS: "90", comment: "" });
const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const field = "mt-1 min-h-14 w-full rounded-xl border border-line bg-surface px-4 font-display text-2xl font-bold tabular-nums";
const small = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 font-display text-xl font-bold tabular-nums";

export default function RecordPage() {
  const router = useRouter();
  const [type, setType] = useState<(typeof SPORT_KEYS)[number]>("RUN");
  const [f, setF] = useState({ title: "", when: localNow(), km: "", h: "", min: "", elev: "", notes: "" });
  const [feeling, setFeeling] = useState<string | null>(null);
  const [exs, setExs] = useState<Ex[]>([blank(1)]), [nextId, setNextId] = useState(2);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [res, setRes] = useState<{ story: string; record: boolean; id: string } | null>(null);
  const workout = type === "WORKOUT"; // rendu conditionnel : tout le formulaire en dépend
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const upd = (id: number, k: keyof Ex, v: string) => setExs((l) => l.map((e) => (e.id === id ? { ...e, [k]: v } : e)));
  const add = () => { tap(); setExs((l) => [...l, blank(nextId)]); setNextId(nextId + 1); };
  const remove = (id: number) => { tap(); setExs((l) => (l.length > 1 ? l.filter((e) => e.id !== id) : l)); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const movingTimeS = num(f.h) * 3600 + num(f.min) * 60;
    if (movingTimeS <= 0) return setErr("Indiquez la durée de la sortie.");
    let exercises: unknown[] | undefined;
    if (workout) {
      const list = exs.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), sets: Math.round(num(x.sets)), reps: Math.round(num(x.reps)), loadKg: x.loadKg.trim() === "" ? null : num(x.loadKg), restS: x.restS.trim() === "" ? null : Math.round(num(x.restS)), comment: x.comment.trim() || null }));
      if (!list.length || list.some((x) => x.sets < 1 || x.reps < 1)) return setErr("Ajoutez au moins un exercice avec son nom, ses séries et ses répétitions.");
      exercises = list;
    }
    setBusy(true); setErr("");
    const hour = new Date(f.when).getHours();
    const title = f.title.trim() || `${SPORTS[type].label} ${hour < 12 ? "du matin" : hour < 18 ? "de l’après-midi" : "du soir"}`;
    const r = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      type, title, startedAt: new Date(f.when).toISOString(), distanceM: workout ? 0 : num(f.km) * 1000, movingTimeS, elevationGainM: workout ? 0 : num(f.elev), feeling, notes: f.notes || null, exercises }) });
    setBusy(false);
    if (!r.ok) return setErr("Impossible d’enregistrer. Vérifiez votre connexion et réessayez.");
    const j = await r.json(); setRes({ story: j.story, record: j.record, id: j.id });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="font-display text-3xl font-bold leading-none">Nouvelle sortie</h1>
      <div role="radiogroup" aria-label="Sport" className="grid grid-cols-2 gap-2">
        {SPORT_KEYS.map((k) => { const I = SPORTS[k].icon, on = type === k; return (
          <button type="button" key={k} role="radio" aria-checked={on} onClick={() => { tap(); setType(k); setErr(""); }}
            className={cn("flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold", on ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface")}>
            <I className="h-6 w-6" aria-hidden />{SPORTS[k].label}
          </button>); })}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {!workout && <>
          <label className="text-sm text-ink-soft">Distance (km)<input inputMode="decimal" value={f.km} onChange={set("km")} placeholder="0" className={field} /></label>
          <label className="text-sm text-ink-soft">Dénivelé + (m)<input inputMode="numeric" value={f.elev} onChange={set("elev")} placeholder="0" className={field} /></label>
        </>}
        <label className="text-sm text-ink-soft">Heures<input inputMode="numeric" value={f.h} onChange={set("h")} placeholder="0" className={field} /></label>
        <label className="text-sm text-ink-soft">Minutes<input inputMode="numeric" value={f.min} onChange={set("min")} placeholder="0" className={field} /></label>
      </div>

      {workout && (
        <section aria-label="Exercices" className="space-y-3">
          <h2 className="font-display text-xl font-bold">Exercices</h2>
          {exs.map((x, i) => (
            <fieldset key={x.id} className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
              <legend className="sr-only">Exercice {i + 1}</legend>
              <div className="flex items-end gap-2">
                <label className="flex-1 text-sm text-ink-soft">Exercice {i + 1}<input value={x.name} onChange={(e) => upd(x.id, "name", e.target.value)} placeholder="Ex. Développé couché, Pompes…" className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base font-semibold" /></label>
                {exs.length > 1 && <button type="button" onClick={() => remove(x.id)} aria-label={`Supprimer l’exercice ${i + 1}`} className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-ink-soft"><Trash2 className="h-5 w-5" aria-hidden /></button>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
                <label>Séries<input inputMode="numeric" value={x.sets} onChange={(e) => upd(x.id, "sets", e.target.value)} className={small} /></label>
                <label>Répétitions<input inputMode="numeric" value={x.reps} onChange={(e) => upd(x.id, "reps", e.target.value)} className={small} /></label>
                <label>Charge (kg)<input inputMode="decimal" value={x.loadKg} onChange={(e) => upd(x.id, "loadKg", e.target.value)} placeholder="Poids de corps" className={small} /></label>
                <label>Repos (secondes)<input inputMode="numeric" value={x.restS} onChange={(e) => upd(x.id, "restS", e.target.value)} className={small} /></label>
              </div>
              <label className="block text-sm text-ink-soft">Commentaire (facultatif)<input value={x.comment} onChange={(e) => upd(x.id, "comment", e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base" /></label>
            </fieldset>
          ))}
          <button type="button" onClick={add} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand font-semibold text-brand"><Plus className="h-5 w-5" aria-hidden />Ajouter un exercice</button>
        </section>
      )}

      <label className="block text-sm text-ink-soft">Date et heure<input type="datetime-local" value={f.when} onChange={set("when")} className={cn(field, "text-lg font-semibold")} /></label>
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
