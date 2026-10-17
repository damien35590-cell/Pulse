"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { beep, restOver, tap } from "@/lib/haptics";
import { daysAgo, exerciseKey, suggestExercises, type ExerciseHistory, type SetDetail } from "@/lib/exercises";
import { describe, suggestGoal } from "@/lib/progression";
import { StoryReveal } from "@/components/record/story-reveal";
import { RpePicker } from "@/components/activity/rpe-picker";

const FEELINGS = [["GREAT", "Super"], ["GOOD", "Bien"], ["OK", "Correct"], ["TIRED", "Fatigué"], ["HARD", "Difficile"]] as const;
const STORE = "pulse-session-v1";

/** Un exercice de la séance : le prévu (sets/reps/loadKg/restS), le réel (done) et les valeurs en cours de saisie (curReps/curLoad). */
type SEx = { name: string; sets: number; reps: number; loadKg: number | null; restS: number; done: SetDetail[]; curReps: number; curLoad: number | null; hint?: string };
type State = { startedAt: number; phase: "setup" | "run" | "finish"; idx: number; exs: SEx[]; rest: { endsAt: number; total: number } | null; title?: string };
const fresh = (): State => ({ startedAt: Date.now(), phase: "setup", idx: 0, exs: [], rest: null });

const big = "grid min-h-14 min-w-14 place-items-center rounded-xl bg-surface-2 active:scale-95";
const kgFmt = (n: number | null) => (n == null ? "Poids de corps" : `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} kg`);

function Stepper({ label, value, text, onMinus, onPlus }: { label: string; value?: number; text?: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => { tap(); onMinus(); }} aria-label={`${label} : moins`} className={big}><Minus className="h-6 w-6" aria-hidden /></button>
      <div className="flex-1 text-center"><p className="text-xs text-ink-soft">{label}</p><p className="font-display text-4xl font-bold tabular-nums leading-tight">{text ?? value}</p></div>
      <button type="button" onClick={() => { tap(); onPlus(); }} aria-label={`${label} : plus`} className={big}><Plus className="h-6 w-6" aria-hidden /></button>
    </div>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const [s, setS] = useState<State | null>(null); // null tant que localStorage n'est pas lu
  const [hist, setHist] = useState<ExerciseHistory[]>([]), [q, setQ] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [rpe, setRpe] = useState<number | null>(null), [feeling, setFeeling] = useState<string | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const [res, setRes] = useState<{ story: string; record: boolean; id: string } | null>(null);

  useEffect(() => {
    let saved: State | null = null;
    try { saved = JSON.parse(localStorage.getItem(STORE) ?? "null"); } catch { /* ignoré */ }
    setS(saved?.exs ? saved : fresh());
    fetch("/api/exercises").then((r) => (r.ok ? r.json() : [])).then(setHist).catch(() => {});
  }, []);
  // Sauvegarde à chaque changement : la séance survit à un rafraîchissement ou à un appel.
  useEffect(() => { if (s && !res) try { localStorage.setItem(STORE, JSON.stringify(s)); } catch { /* stockage indisponible */ } }, [s, res]);

  // Écran allumé : verrou acquis à l'arrivée, réacquis au retour sur l'onglet, relâché en partant.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null, dead = false;
    const take = async () => { try { if (!dead && document.visibilityState === "visible") lock = (await navigator.wakeLock?.request("screen")) ?? null; } catch { /* refusé (économie d'énergie…) */ } };
    const onVis = () => { if (document.visibilityState === "visible") { take(); setNow(Date.now()); } };
    take(); document.addEventListener("visibilitychange", onVis);
    return () => { dead = true; document.removeEventListener("visibilitychange", onVis); lock?.release().catch(() => {}); };
  }, []);

  // Minuteur de repos : l'heure de fin fait foi (l'onglet peut être suspendu).
  const endsAt = s?.rest?.endsAt;
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);
  const over = useRef(false);
  useEffect(() => {
    if (!s?.rest) { over.current = false; return; }
    if (now >= s.rest.endsAt && !over.current) { over.current = true; restOver(); beep(); setS((p) => p && { ...p, rest: null }); }
  }, [now, s?.rest]);

  const upd = useCallback((f: (p: State) => State) => setS((p) => (p ? f(p) : p)), []);
  const patchEx = (i: number, p: Partial<SEx>) => upd((st) => ({ ...st, exs: st.exs.map((e, j) => (j === i ? { ...e, ...p } : e)) }));

  if (!s) return <div className="fixed inset-0 z-50 bg-bg" />;
  const shell = "fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg p-4";
  const quit = () => { if (!s.exs.length || confirm("Abandonner la séance en cours ?")) { try { localStorage.removeItem(STORE); } catch { /* */ } router.push("/record"); } };

  function addExercise(name: string, h?: ExerciseHistory) {
    const g = h && suggestGoal(h.sessions), l = h?.sessions[0];
    upd((st) => ({ ...st, exs: [...st.exs, {
      name: h?.name ?? name.trim(), sets: g?.sets ?? 3, reps: g?.reps ?? 10, loadKg: g ? g.loadKg : null, restS: l?.restS ?? 90, done: [], curReps: g?.reps ?? 10, curLoad: g ? g.loadKg : null, hint: g ? `Objectif du jour : ${g.text}${g.hint ? ` · ${g.hint}` : ""} (dernière fois : ${describe(l!)}, ${daysAgo(l!.date)})` : undefined,
    }] }));
    setQ("");
  }

  // ─────────── Préparation : choisir les exercices ───────────
  if (s.phase === "setup") {
    const sug = suggestExercises(q, hist, 5), exact = hist.find((h) => h.key === exerciseKey(q));
    return (
      <div className={shell}>
        <header className="flex items-center justify-between"><h1 className="font-display text-2xl font-bold">Séance de muscu</h1>
          <button type="button" onClick={quit} aria-label="Quitter" className={big}><X className="h-6 w-6" aria-hidden /></button></header>
        <section className="mt-4 space-y-3">
          {s.exs.map((e, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between"><p className="font-semibold">{e.name}</p>
                <button type="button" onClick={() => upd((st) => ({ ...st, exs: st.exs.filter((_, j) => j !== i) }))} aria-label={`Retirer ${e.name}`} className="grid h-12 w-12 place-items-center text-ink-soft"><X className="h-5 w-5" aria-hidden /></button></div>
              {e.hint && <p className="text-xs text-brand">{e.hint}</p>}
              <Stepper label="Séries" value={e.sets} onMinus={() => patchEx(i, { sets: Math.max(1, e.sets - 1) })} onPlus={() => patchEx(i, { sets: Math.min(30, e.sets + 1) })} />
              <Stepper label="Répétitions" value={e.reps} onMinus={() => { const r = Math.max(1, e.reps - 1); patchEx(i, { reps: r, curReps: r }); }} onPlus={() => patchEx(i, { reps: e.reps + 1, curReps: e.reps + 1 })} />
              <Stepper label="Charge" text={kgFmt(e.loadKg)} onMinus={() => { const l = e.loadKg == null || e.loadKg <= 2.5 ? null : e.loadKg - 2.5; patchEx(i, { loadKg: l, curLoad: l }); }} onPlus={() => { const l = (e.loadKg ?? 0) + 2.5; patchEx(i, { loadKg: l, curLoad: l }); }} />
              <Stepper label="Repos (s)" value={e.restS} onMinus={() => patchEx(i, { restS: Math.max(0, e.restS - 15) })} onPlus={() => patchEx(i, { restS: e.restS + 15 })} />
            </div>))}
        </section>
        <section className="mt-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter un exercice…" autoComplete="off" className="min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-lg font-semibold" />
          <ul className="mt-2 space-y-2">
            {sug.map((h) => <li key={h.key}><button type="button" onClick={() => { tap(); addExercise(q, h); }} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-surface-2 px-4 text-left"><span className="font-semibold">{h.name}</span><span className="text-xs text-ink-soft">{describe(h.sessions[0])}</span></button></li>)}
            {q.trim() && !exact && <li><button type="button" onClick={() => { tap(); addExercise(q); }} className="min-h-14 w-full rounded-xl border border-dashed border-brand px-4 text-left font-semibold text-brand">Nouvel exercice : « {q.trim()} »</button></li>}
          </ul>
        </section>
        <button type="button" disabled={!s.exs.length} onClick={() => { tap(20); upd((st) => ({ ...st, phase: "run", idx: 0, startedAt: Date.now() })); }} className="mt-auto min-h-14 w-full rounded-xl bg-brand pt-0 font-display text-xl font-semibold text-brand-ink disabled:opacity-50">Démarrer la séance</button>
      </div>
    );
  }

  // ─────────── Fin : effort, ressenti, enregistrement ───────────
  if (s.phase === "finish") {
    const doneSets = s.exs.reduce((n, e) => n + e.done.length, 0);
    const save = async () => {
      const movingTimeS = Math.max(60, Math.round((Date.now() - s.startedAt) / 1000));
      const exercises = s.exs.filter((e) => e.done.length).map((e) => ({ name: e.name, sets: e.sets, reps: e.reps, loadKg: e.loadKg, restS: e.restS, setsDetail: e.done }));
      if (!exercises.length) return setErr("Aucune série enregistrée.");
      setBusy(true); setErr("");
      const hour = new Date(s.startedAt).getHours();
      const r = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        type: "WORKOUT", title: s.title?.trim() || `Musculation ${hour < 12 ? "du matin" : hour < 18 ? "de l’après-midi" : "du soir"}`, startedAt: new Date(s.startedAt).toISOString(), movingTimeS, feeling, rpe, exercises, gearIds: [] }) });
      setBusy(false);
      if (!r.ok) return setErr("Impossible d’enregistrer. Vos séries sont conservées : réessayez.");
      const j = await r.json(); try { localStorage.removeItem(STORE); } catch { /* */ }
      setRes({ story: j.story, record: j.record, id: j.id });
    };
    return (
      <div className={shell}>
        <h1 className="font-display text-3xl font-bold">Séance terminée</h1>
        <p className="mt-1 text-ink-soft">{doneSets} série{doneSets > 1 ? "s" : ""} sur {s.exs.length} exercice{s.exs.length > 1 ? "s" : ""}, {Math.max(1, Math.round((Date.now() - s.startedAt) / 60000))} min.</p>
        <div className="mt-5 space-y-5">
          <label className="block text-sm text-ink-soft">Nom de la séance (facultatif)<input value={s.title ?? ""} onChange={(e) => upd((st) => ({ ...st, title: e.target.value }))} maxLength={120} placeholder={`Musculation ${new Date(s.startedAt).getHours() < 12 ? "du matin" : new Date(s.startedAt).getHours() < 18 ? "de l’après-midi" : "du soir"}`} className="mt-1 min-h-14 w-full rounded-xl border border-line bg-surface px-4 text-lg font-semibold" /></label>
          <RpePicker value={rpe} onChange={setRpe} />
          <div role="radiogroup" aria-label="Ressenti" className="flex flex-wrap gap-2">
            {FEELINGS.map(([k, l]) => <button type="button" key={k} role="radio" aria-checked={feeling === k} onClick={() => { tap(); setFeeling(feeling === k ? null : k); }} className={cn("min-h-14 rounded-full px-5 font-medium", feeling === k ? "bg-brand text-brand-ink" : "bg-surface-2")}>{l}</button>)}
          </div>
        </div>
        {err && <p role="alert" className="mt-3 text-sm font-medium text-brand">{err}</p>}
        <div className="mt-auto space-y-2 pt-6">
          <button type="button" disabled={busy} onClick={save} className="min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink disabled:opacity-60">{busy ? "Enregistrement…" : "Enregistrer la séance"}</button>
          <button type="button" onClick={() => upd((st) => ({ ...st, phase: "run" }))} className="min-h-14 w-full rounded-xl bg-surface-2 font-semibold">Revenir à la séance</button>
        </div>
        {res && <StoryReveal story={res.story} record={res.record} onClose={() => { router.push(`/activities/${res.id}`); router.refresh(); }} />}
      </div>
    );
  }

  // ─────────── Séance : un exercice à la fois ───────────
  const e = s.exs[s.idx], k = e.done.length, complete = k >= e.sets, last = s.idx === s.exs.length - 1;
  const left = s.rest ? Math.max(0, Math.ceil((s.rest.endsAt - now) / 1000)) : 0;
  const go = (i: number) => { tap(); upd((st) => ({ ...st, idx: Math.min(Math.max(i, 0), st.exs.length - 1) })); };

  function validate() {
    tap(20);
    const done = [...e.done, { reps: e.curReps, loadKg: e.curLoad, done: true }];
    upd((st) => {
      const finished = done.length >= e.sets, exs = st.exs.map((x, j) => (j === st.idx ? { ...x, done } : x));
      if (finished && last) return { ...st, exs, phase: "finish", rest: null };
      return { ...st, exs, idx: finished ? st.idx + 1 : st.idx, rest: e.restS > 0 ? { endsAt: Date.now() + e.restS * 1000, total: e.restS * 1000 } : null };
    });
    setNow(Date.now());
  }

  if (s.rest && left > 0) {
    const next = s.exs[s.idx], frac = Math.min(1, left * 1000 / s.rest.total);
    return (
      <div className={cn(shell, "items-center justify-center text-center")} role="timer" aria-live="off">
        <p className="text-lg text-ink-soft">Repos</p>
        <p className="font-display text-[8rem] font-bold leading-none tabular-nums">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</p>
        <div className="mt-4 h-2 w-64 max-w-full overflow-hidden rounded-full bg-surface-2"><div className="h-full bg-brand" style={{ width: `${frac * 100}%` }} /></div>
        <p className="mt-6 text-ink-soft">Ensuite : <span className="font-semibold text-ink">{next.name}</span>, série {next.done.length + 1}/{next.sets}</p>
        <div className="mt-8 grid w-full max-w-sm grid-cols-2 gap-3">
          <button type="button" onClick={() => { tap(); upd((st) => ({ ...st, rest: st.rest && { endsAt: st.rest.endsAt + 15000, total: st.rest.total + 15000 } })); }} className="min-h-14 rounded-xl bg-surface-2 font-display text-xl font-semibold">+15 s</button>
          <button type="button" onClick={() => { tap(); upd((st) => ({ ...st, rest: null })); }} className="min-h-14 rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink">Passer</button>
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <header className="flex items-center justify-between gap-2">
        <button type="button" onClick={quit} aria-label="Quitter la séance" className={big}><X className="h-6 w-6" aria-hidden /></button>
        <p className="text-sm text-ink-soft">Exercice {s.idx + 1}/{s.exs.length}</p>
        <button type="button" onClick={() => { tap(); upd((st) => ({ ...st, phase: "finish" })); }} className="min-h-14 rounded-xl px-4 font-semibold text-brand">Terminer</button>
      </header>
      <div className="mt-3 text-center">
        <h1 className="font-display text-3xl font-bold leading-tight">{e.name}</h1>
        <p className="mt-1 text-ink-soft">Série {Math.min(k + 1, e.sets)} sur {e.sets} · prévu {describe({ sets: e.sets, reps: e.reps, loadKg: e.loadKg })}</p>
        {e.done.length > 0 && <p className="mt-1 text-sm tabular-nums text-ink-soft">Faites : {e.done.map((d) => d.reps).join(" · ")}</p>}
      </div>
      <div className="my-6 space-y-5">
        <Stepper label="Répétitions" value={e.curReps} onMinus={() => patchEx(s.idx, { curReps: Math.max(0, e.curReps - 1) })} onPlus={() => patchEx(s.idx, { curReps: e.curReps + 1 })} />
        <Stepper label="Charge" text={kgFmt(e.curLoad)} onMinus={() => patchEx(s.idx, { curLoad: e.curLoad == null || e.curLoad <= 2.5 ? null : e.curLoad - 2.5 })} onPlus={() => patchEx(s.idx, { curLoad: (e.curLoad ?? 0) + 2.5 })} />
      </div>
      <div className="mt-auto space-y-3">
        {complete
          ? <button type="button" onClick={() => patchEx(s.idx, { sets: e.sets + 1 })} className="min-h-14 w-full rounded-xl bg-surface-2 font-semibold">+ Une série de plus</button>
          : <button type="button" onClick={validate} className="flex min-h-20 w-full items-center justify-center gap-3 rounded-xl bg-brand font-display text-2xl font-bold text-brand-ink active:scale-[0.98]"><Check className="h-7 w-7" aria-hidden />Série faite</button>}
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={s.idx === 0} onClick={() => go(s.idx - 1)} className={cn(big, "w-full grid-flow-col gap-2 font-semibold disabled:opacity-40")}><ArrowLeft className="h-5 w-5" aria-hidden />Précédent</button>
          <button type="button" disabled={last} onClick={() => go(s.idx + 1)} className={cn(big, "w-full grid-flow-col gap-2 font-semibold disabled:opacity-40")}>Suivant<ArrowRight className="h-5 w-5" aria-hidden /></button>
        </div>
      </div>
    </div>
  );
}
