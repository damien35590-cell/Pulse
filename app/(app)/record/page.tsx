"use client";
import { FeelPicker, FEELING_KEYS } from "@/components/activity/feel-picker";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { tap } from "@/lib/haptics";
import { StoryReveal } from "@/components/record/story-reveal";
import { defaultGear, GEAR_KINDS, selectableGear, type WearLevel } from "@/lib/gear";
import { RpePicker } from "@/components/activity/rpe-picker";
import { daysAgo, exerciseKey, suggestExercises, type ExerciseHistory } from "@/lib/exercises";
import { describe, suggestGoal } from "@/lib/progression";
import { suggestCatalog } from "@/lib/training/match-exercise";
import { EQUIPMENT_LABELS } from "@/lib/training/catalog/exercises";
import { NewSessionButton } from "@/components/workout/new-session-sheet";

const SPORT_KEYS = ["WORKOUT", "RUN", "RIDE", "HIKE"] as const;
type SetRow = { reps: string; load: string; done: boolean };
type Ex = { id: number; name: string; sets: string; reps: string; loadKg: string; restS: string; comment: string; pk: string; detail: SetRow[] | null };
const blank = (id: number): Ex => ({ id, name: "", sets: "3", reps: "10", loadKg: "", restS: "90", comment: "", pk: "", detail: null });
const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;
const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const field = "mt-1 min-h-14 w-full rounded-xl border border-line bg-surface px-4 font-display text-2xl font-bold tabular-nums";
type GearOpt = { id: string; name: string; kind: keyof typeof GEAR_KINDS; sports: string[]; isDefault: boolean; parentId: string | null; retiredAt: null; km: number; limitKm: number | null; level: WearLevel };
type WornGear = { name: string; km: number; limitKm: number | null };
const small = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 font-display text-xl font-bold tabular-nums";

export default function RecordPage() {
  const router = useRouter();
  const [type, setType] = useState<(typeof SPORT_KEYS)[number]>("RUN");
  const [f, setF] = useState({ title: "", when: localNow(), km: "", h: "", min: "", elev: "", notes: "" });
  const [feeling, setFeeling] = useState<string | null>(null), [rpe, setRpe] = useState<number | null>(null);
  const [exs, setExs] = useState<Ex[]>([blank(1)]), [nextId, setNextId] = useState(2);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [res, setRes] = useState<{ story: string; record: boolean; id: string; gearAlerts?: WornGear[] } | null>(null);
  const [gear, setGear] = useState<GearOpt[]>([]), [gearId, setGearId] = useState("");
  useEffect(() => { fetch("/api/gear").then((r) => (r.ok ? r.json() : [])).then(setGear).catch(() => {}); }, []);
  // Changement de sport (ou matériel chargé) : on repart du matériel par défaut de ce sport.
  useEffect(() => { setGearId(defaultGear(gear, type)?.id ?? ""); }, [gear, type]);
  const gearOpts = selectableGear(gear, type);
  const worn = gear.filter((g) => gearId && (g.id === gearId || g.parentId === gearId) && g.level === "critical");
  const workout = type === "WORKOUT"; // rendu conditionnel : tout le formulaire en dépend
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const patch = (id: number, p: Partial<Ex>) => setExs((l) => l.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const upd = (id: number, k: keyof Ex, v: string) => patch(id, { [k]: v });
  // Mes exercices passés (par fréquence) : autocomplétion, préremplissage et objectif du jour.
  const [hist, setHist] = useState<ExerciseHistory[]>([]), [open, setOpen] = useState<number | null>(null);
  useEffect(() => { if (workout && !hist.length) fetch("/api/exercises").then((r) => (r.ok ? r.json() : [])).then(setHist).catch(() => {}); }, [workout, hist.length]);
  const found = (name: string) => hist.find((h) => h.key === exerciseKey(name));
  /** Reprend le nom canonique et la dernière séance (séries, reps, charge, repos) ; une seule fois par exercice choisi. */
  const choose = (id: number, h: ExerciseHistory) => { const l = h.sessions[0]; patch(id, { name: h.name, pk: h.key, detail: null, sets: String(l.sets), reps: String(l.reps), loadKg: l.loadKg == null ? "" : String(l.loadKg), restS: l.restS == null ? "" : String(l.restS) }); setOpen(null); };
  const blurName = (x: Ex) => { setOpen(null); const h = found(x.name); if (h && h.key !== x.pk) choose(x.id, h); };
  const toggleDetail = (x: Ex) => { tap(); patch(x.id, { detail: x.detail ? null : Array.from({ length: Math.min(30, Math.max(1, Math.round(num(x.sets)))) }, () => ({ reps: x.reps, load: x.loadKg, done: true })) }); };
  const updRow = (x: Ex, i: number, p: Partial<SetRow>) => patch(x.id, { detail: x.detail!.map((r, j) => (j === i ? { ...r, ...p } : r)) });
  const add = () => { tap(); setExs((l) => [...l, blank(nextId)]); setNextId(nextId + 1); };
  const remove = (id: number) => { tap(); setExs((l) => (l.length > 1 ? l.filter((e) => e.id !== id) : l)); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const movingTimeS = num(f.h) * 3600 + num(f.min) * 60;
    if (movingTimeS <= 0) return setErr("Indique la durée de la sortie.");
    let exercises: unknown[] | undefined;
    if (workout) {
      const list = exs.filter((x) => x.name.trim()).map((x) => ({ name: x.name.trim(), sets: Math.round(num(x.sets)), reps: Math.round(num(x.reps)), loadKg: x.loadKg.trim() === "" ? null : num(x.loadKg), restS: x.restS.trim() === "" ? null : Math.round(num(x.restS)), comment: x.comment.trim() || null, setsDetail: x.detail?.map((r) => ({ reps: Math.round(num(r.reps)), loadKg: r.load.trim() === "" ? null : num(r.load), done: r.done })) }));
      if (!list.length || list.some((x) => x.sets < 1 || x.reps < 1)) return setErr("Ajoute au moins un exercice avec son nom, ses séries et ses répétitions.");
      exercises = list;
    }
    setBusy(true); setErr("");
    const hour = new Date(f.when).getHours();
    const title = f.title.trim() || `${SPORTS[type].label} ${hour < 12 ? "du matin" : hour < 18 ? "de l’après-midi" : "du soir"}`;
    const r = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      type, title, titleEdited: !!f.title.trim(), startedAt: new Date(f.when).toISOString(), distanceM: workout ? 0 : num(f.km) * 1000, movingTimeS, elevationGainM: workout ? 0 : num(f.elev), feeling, rpe, notes: f.notes || null, exercises, gearIds: gearId ? [gearId] : [] }) });
    setBusy(false);
    if (!r.ok) return setErr("Impossible d’enregistrer. Vérifie ta connexion et réessaie.");
    const j = await r.json(); setRes({ story: j.story, record: j.record, id: j.id, gearAlerts: j.gearAlerts });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <h1 className="font-display text-3xl font-bold leading-none">Saisie manuelle</h1>
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
        <NewSessionButton />
      )}

      {workout && (
        <section aria-label="Exercices" className="space-y-3">
          <h2 className="font-display text-xl font-bold">Exercices</h2>
          {exs.map((x, i) => (
            <fieldset key={x.id} className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
              <legend className="sr-only">Exercice {i + 1}</legend>
              <div className="flex items-end gap-2">
                <div className="relative flex-1">
                  <label className="text-sm text-ink-soft">Exercice {i + 1}<input value={x.name} onChange={(e) => { upd(x.id, "name", e.target.value); setOpen(x.id); }} onFocus={() => setOpen(x.id)} onBlur={() => blurName(x)} autoComplete="off" role="combobox" aria-expanded={open === x.id} aria-autocomplete="list" placeholder="Ex. Développé couché, Pompes…" className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base font-semibold" /></label>
                  {open === x.id && (() => { const sug = suggestExercises(x.name, hist, 50), cat = suggestCatalog(x.name, hist.map((h) => h.key)); return sug.length + cat.length > 0 && (
                    <ul role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-xl border border-line bg-surface shadow-lg">
                      {sug.map((h) => <li key={h.key} role="option" aria-selected={h.key === exerciseKey(x.name)}>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { tap(); choose(x.id, h); }} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left">
                          <span className="font-semibold">{h.name}</span><span className="text-xs text-ink-soft">{describe(h.sessions[0])}</span>
                        </button></li>)}
                      {cat.length > 0 && <li role="presentation" className="sticky top-0 bg-surface-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">Catalogue</li>}
                      {cat.map((c) => <li key={c.slug} role="option" aria-selected={false}>
                        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { tap(); patch(x.id, { name: c.name, pk: exerciseKey(c.name), detail: null }); setOpen(null); }} className="flex min-h-12 w-full items-center justify-between gap-3 px-3 text-left">
                          <span className="font-semibold">{c.name}</span><span className="shrink-0 text-xs text-ink-soft">{EQUIPMENT_LABELS[c.equipment]}{c.difficulty ? ` · ${c.difficulty}/10` : ""}</span>
                        </button></li>)}
                    </ul>); })()}
                </div>
                {exs.length > 1 && <button type="button" onClick={() => remove(x.id)} aria-label={`Supprimer l’exercice ${i + 1}`} className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-ink-soft"><Trash2 className="h-5 w-5" aria-hidden /></button>}
              </div>
              {(() => { const h = found(x.name); if (!h) return null; const g = suggestGoal(h.sessions), cur = `${x.sets}|${x.reps}|${x.loadKg}`; return (
                <div className="space-y-2">
                  <p className="text-xs text-ink-soft">Dernière fois : {describe(h.sessions[0])}, {daysAgo(h.sessions[0].date)}</p>
                  {g && cur !== `${g.sets}|${g.reps}|${g.loadKg ?? ""}` && (
                    <button type="button" onClick={() => { tap(); patch(x.id, { sets: String(g.sets), reps: String(g.reps), loadKg: g.loadKg == null ? "" : String(g.loadKg), detail: null }); }}
                      className="flex min-h-12 w-full flex-col items-start justify-center rounded-xl bg-brand/10 px-3 py-1.5 text-left text-brand">
                      <span className="text-sm font-semibold">Objectif du jour : {g.text}</span>
                      {g.hint && <span className="text-xs">{g.hint}</span>}
                    </button>)}
                </div>); })()}
              <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
                <label>Séries<input inputMode="numeric" value={x.sets} onChange={(e) => upd(x.id, "sets", e.target.value)} className={small} /></label>
                <label>Répétitions<input inputMode="numeric" value={x.reps} onChange={(e) => upd(x.id, "reps", e.target.value)} className={small} /></label>
                <label>Charge (kg)<input inputMode="decimal" value={x.loadKg} onChange={(e) => upd(x.id, "loadKg", e.target.value)} placeholder="Poids de corps" className={small} /></label>
                <label>Repos (secondes)<input inputMode="numeric" value={x.restS} onChange={(e) => upd(x.id, "restS", e.target.value)} className={small} /></label>
              </div>
              {x.detail && (
                <ul className="space-y-2" aria-label="Séries réalisées">
                  {x.detail.map((r, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <span className="w-6 text-sm text-ink-soft">{j + 1}</span>
                      <input inputMode="numeric" aria-label={`Série ${j + 1}, répétitions`} value={r.reps} onChange={(e) => updRow(x, j, { reps: e.target.value })} className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-center font-display text-xl font-bold tabular-nums" />
                      <span className="text-ink-soft">×</span>
                      <input inputMode="decimal" aria-label={`Série ${j + 1}, charge en kilos`} value={r.load} placeholder="kg" onChange={(e) => updRow(x, j, { load: e.target.value })} className="min-h-12 w-full min-w-0 rounded-xl border border-line bg-bg px-3 text-center font-display text-xl font-bold tabular-nums" />
                      <button type="button" role="switch" aria-checked={r.done} aria-label={`Série ${j + 1} réussie`} onClick={() => { tap(); updRow(x, j, { done: !r.done }); }} className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-bold", r.done ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-soft")}>{r.done ? "✓" : "✗"}</button>
                    </li>))}
                </ul>)}
              <button type="button" onClick={() => toggleDetail(x)} className="min-h-12 w-full rounded-xl bg-surface-2 text-sm font-semibold text-ink-soft">{x.detail ? "Masquer le détail des séries" : "Saisir série par série"}</button>
              <label className="block text-sm text-ink-soft">Commentaire (facultatif)<input value={x.comment} onChange={(e) => upd(x.id, "comment", e.target.value)} className="mt-1 min-h-12 w-full rounded-xl border border-line bg-bg px-3 text-base" /></label>
            </fieldset>
          ))}
          <button type="button" onClick={add} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-brand font-semibold text-brand"><Plus className="h-5 w-5" aria-hidden />Ajouter un exercice</button>
        </section>
      )}

      {!workout && gearOpts.length > 0 && (
        <div>
          <label className="block text-sm text-ink-soft">Matériel utilisé
            <select value={gearId} onChange={(e) => { tap(); setGearId(e.target.value); }} className={cn(field, "text-lg font-semibold")}>
              <option value="">Aucun</option>
              {gearOpts.map((g) => <option key={g.id} value={g.id}>{gear.some((p) => (p.id === g.id || p.parentId === g.id) && p.level === "critical") ? "⚠ " : ""}{g.name} ({GEAR_KINDS[g.kind].label}, {g.km.toLocaleString("fr-FR")} km)</option>)}
            </select>
          </label>
          {worn.length > 0 && <p role="status" className="mt-2 flex gap-2 rounded-xl bg-bad/10 px-3 py-2.5 text-sm text-bad"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{worn.map((g) => `${g.name} : ${g.km.toLocaleString("fr-FR")} / ${g.limitKm?.toLocaleString("fr-FR")} km`).join(" · ")}. Seuil critique dépassé.</p>}
        </div>
      )}
      <label className="block text-sm text-ink-soft">Date et heure<input type="datetime-local" value={f.when} onChange={set("when")} className={cn(field, "text-lg font-semibold")} /></label>
      <label className="block text-sm text-ink-soft">Titre (facultatif)<input value={f.title} onChange={set("title")} className={cn(field, "text-lg font-semibold")} /></label>
      <FeelPicker value={feeling ? FEELING_KEYS.indexOf(feeling as (typeof FEELING_KEYS)[number]) + 1 : null} onChange={(v) => { tap(); const k = FEELING_KEYS[v - 1]; setFeeling(feeling === k ? null : k); }} />
      <RpePicker value={rpe} onChange={setRpe} />
      <label className="block text-sm text-ink-soft">Notes<textarea value={f.notes} onChange={set("notes")} rows={3} className="mt-1 w-full rounded-xl border border-line bg-surface p-4 text-base" /></label>
      {err && <p role="alert" className="text-sm font-medium text-brand">{err}</p>}
      <button disabled={busy} className="min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer la sortie"}</button>
      <p className="text-center text-sm text-ink-soft">Tu as un fichier GPX ou FIT ? <Link href="/import" className="font-semibold text-brand">Importe-le</Link></p>
      {res && <StoryReveal story={res.story} record={res.record} alerts={res.gearAlerts?.map((g) => `${g.name} a atteint ${g.km.toLocaleString("fr-FR")} km (seuil ${g.limitKm?.toLocaleString("fr-FR")} km) : pense à le remplacer.`)} onClose={() => { router.push(`/activities/${res.id}`); router.refresh(); }} />}
    </form>
  );
}
