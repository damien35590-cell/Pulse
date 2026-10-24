"use client";
import { useEffect, useRef, useState } from "react";
import { Check, History, Plus, SkipForward, Target, Timer, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { beep, celebrate, restOver, tap } from "@/lib/haptics";
import { fmtClock, fmtNum } from "@/lib/format";
import { NumberStepper } from "@/components/ui/number-stepper";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { Metric } from "@/components/ui/metric";
import { Switch } from "@/components/ui/switch";

export type LiftSet = { reps: number; kg: number };
export type LiftExercise = {
  name: string;
  sets: number;
  reps: number;
  kg: number;
  /** Pas du stepper de charge : 2 kg (paire d'haltères), 2,5 kg (barre), 1 kg… */
  step: number;
  /** Repos entre deux séries. */
  restS: number;
  /** Repos avant l'exercice suivant (par défaut restS). */
  restAfterS?: number;
  /** Poids du corps : kg = lest (0 = PDC). */
  bodyweight?: boolean;
  /** Exercice tenu (gainage, chaise, essuie-glace…) : « reps » = secondes. */
  timed?: boolean;
  /** Séance précédente, série par série. */
  prev: LiftSet[];
  done: LiftSet[];
};

type Props = {
  title: string;
  program?: string;
  exercises: LiftExercise[];
  startedAt?: number;
  onExit: () => void;
  /**
   * Enregistre la séance. Si fournie, c'est elle qui termine (navigation comprise) ; une erreur levée garde la feuille ouverte.
   * Sans elle, « Enregistrer » quitte simplement.
   */
  onSave?: (exercises: LiftExercise[], opts: { templateName?: string }) => Promise<void> | void;
  /** Appelé à chaque série validée ou corrigée : de quoi reprendre la séance après un appel ou un rafraîchissement. */
  onChange?: (exercises: LiftExercise[]) => void;
  /** Nom proposé pour « Enregistrer comme modèle » ; sans lui, l'option n'apparaît pas. */
  templateName?: string;
};

const fr = (v: number) => fmtNum(v, 2);
const kgTxt = (kg: number, bw?: boolean) => (bw ? (kg ? `+${fr(kg)}` : "PDC") : fr(kg));
const ROW = "grid-cols-[2.25rem_minmax(0,1fr)_3.75rem_3rem_2.25rem]";

function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Saisie d'une séance, pensée pour l'entre-deux-séries : essoufflé, mains moites, téléphone posé au sol.
 * - Tout ce qui se touche fait ≥ 48 px, l'action principale (64 px) est en bas, sous le pouce.
 * - La série est pré-remplie (dernière série faite, sinon l'objectif) : la plupart du temps, 1 seul tap suffit.
 * - Retour immédiat : vibration + bouton qui passe au vert + coche qui « pop » dans le tableau, puis repos.
 */
export function SetLogger({ title, program, exercises, startedAt, onExit, onSave, onChange, templateName }: Props) {
  const [exs, setExs] = useState(() => exercises.map((e) => ({ ...e, done: [...e.done] })));
  const [idx, setIdx] = useState(() => Math.max(0, exercises.findIndex((e) => e.done.length < e.sets)));
  const [edit, setEdit] = useState<number | null>(null); // série déjà faite en cours de correction
  const [draft, setDraft] = useState<LiftSet>({ reps: 0, kg: 0 });
  const [flash, setFlash] = useState(false);
  const [rest, setRest] = useState<{ endsAt: number; total: number; next: string } | null>(null);
  const [quit, setQuit] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tplOn, setTplOn] = useState(false);
  const [tplName, setTplName] = useState(templateName ?? "");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const start = useRef(startedAt ?? Date.now());
  const now = useNow();

  const ex = exs[idx];
  const k = ex.done.length;
  const complete = k >= ex.sets && edit == null;
  const totalSets = exs.reduce((s, e) => s + e.sets, 0);
  const doneSets = exs.reduce((s, e) => s + e.done.length, 0);
  const volume = exs.reduce((s, e) => s + e.done.reduce((v, d) => v + d.reps * d.kg, 0), 0);
  const gain = ex.bodyweight || !ex.prev.length ? 0 : ex.kg - Math.max(...ex.prev.map((p) => p.kg));
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => { onChangeRef.current?.(exs); }, [exs]);

  // Pré-remplissage : dernière série faite, sinon l'objectif.
  useEffect(() => {
    const e = exs[idx], last = e.done[e.done.length - 1];
    setDraft(last ? { ...last } : { reps: e.reps, kg: e.kg });
    setEdit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function pickRow(i: number) {
    if (i > k) return;
    tap(6);
    if (i === k) { setEdit(null); return; }
    setEdit(i);
    setDraft({ ...ex.done[i] });
  }

  function validate() {
    if (flash) return; // anti double tap
    tap(18);
    const set = { ...draft };
    if (edit != null) {
      setExs((l) => l.map((e, i) => (i === idx ? { ...e, done: e.done.map((d, j) => (j === edit ? set : d)) } : e)));
      setEdit(null);
      return;
    }
    const next = exs.map((e, i) => (i === idx ? { ...e, done: [...e.done, set] } : e));
    setExs(next);
    setFlash(true);
    const cur = next[idx];
    const nextIdx = cur.done.length < cur.sets ? idx : next.findIndex((e) => e.done.length < e.sets);
    window.setTimeout(() => {
      setFlash(false);
      if (nextIdx < 0) { celebrate(); setFinished(true); return; }
      if (nextIdx !== idx) setIdx(nextIdx);
      const t = next[nextIdx];
      // Dernière série de l'exercice : repos « après exercice » ; sinon repos entre séries.
      const restS = nextIdx !== idx ? cur.restAfterS ?? cur.restS : cur.restS;
      if (restS > 0) setRest({ endsAt: Date.now() + restS * 1000, total: restS * 1000, next: `${t.name} · série ${t.done.length + 1}/${t.sets}` });
    }, 600);
  }

  async function save() {
    if (saving) return;
    if (!onSave) return onExit();
    setSaving(true);
    setSaveErr("");
    try {
      await onSave(exs, { templateName: tplOn ? tplName.trim() || templateName : undefined });
    } catch (e) {
      setSaveErr(e instanceof Error && e.message ? e.message : "Impossible d’enregistrer. Tes séries sont conservées : réessaie.");
    }
    setSaving(false);
  }

  const elapsed = Math.max(0, Math.round((now - start.current) / 1000));

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col">
        {/* ── En-tête : quitter / titre + chrono / terminer ── */}
        <header className="pt-safe-top">
          <div className="flex h-14 items-center gap-1 px-1">
            <button type="button" onClick={() => setQuit(true)} aria-label="Quitter la séance" className={ui.iconBtn}>
              <X className="size-6" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[15px] font-semibold leading-tight">{title}</p>
              <p className="font-num text-sm tabular-nums text-ink-mute">
                {fmtClock(elapsed)} · {doneSets}/{totalSets} séries
              </p>
            </div>
            <button type="button" onClick={() => { tap(10); setFinished(true); }} className="h-10 touch-manipulation rounded-full px-3.5 text-sm font-semibold text-brand transition active:scale-95 active:bg-brand/10">
              Terminer
            </button>
          </div>
          <div className="mx-4 h-1 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand transition-[width] duration-500 ease-snappy" style={{ width: `${(doneSets / totalSets) * 100}%` }} />
          </div>
          {/* Exercices de la séance : vue d'ensemble + saut direct */}
          <ol className="no-scrollbar flex gap-1.5 overflow-x-auto px-4 py-3" aria-label="Exercices">
            {exs.map((e, i) => {
              const ok = e.done.length >= e.sets, on = i === idx;
              return (
                <li key={e.name}>
                  <button
                    type="button"
                    onClick={() => { if (!on) { tap(6); setIdx(i); } }}
                    aria-label={`${e.name}${ok ? ", terminé" : ""}`}
                    aria-current={on ? "step" : undefined}
                    className={cn(
                      "grid h-8 min-w-8 touch-manipulation place-items-center rounded-full px-2.5 font-num text-sm font-semibold tabular-nums transition active:scale-90",
                      on ? "bg-ink text-bg" : ok ? "bg-good/15 text-good" : "bg-surface-2 text-ink-soft",
                    )}
                  >
                    {ok && !on ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
        </header>

        {/* ── Corps défilant ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          <p className={ui.label}>{program ? `${program} · ` : ""}Exercice {idx + 1}/{exs.length}</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight">{ex.name}</h1>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className={ui.chip}><Target className="size-3.5" aria-hidden />{ex.sets} × {ex.reps}{ex.timed ? " s" : ""} · {kgTxt(ex.kg, ex.bodyweight)}{ex.bodyweight ? "" : " kg"}</span>
            <span className={ui.chip}><Timer className="size-3.5" aria-hidden />Repos {fmtClock(ex.restS)}</span>
            {gain > 0 && <span className={cn(ui.chip, "bg-good/15 text-good")}><TrendingUp className="size-3.5" aria-hidden />+{fr(gain)} kg vs dernière fois</span>}
          </div>

          {/* Tableau des séries (schéma Strong / Hevy) : précédent → réalisé, une ligne = une série */}
          <div className={cn(ui.card, "mt-5 pb-1.5")}>
            <div className={cn("grid items-center gap-2 px-3 pb-1 pt-3 text-label uppercase text-ink-mute", ROW)}>
              <span>Série</span><span>Précédent</span><span className="text-right">kg</span><span className="text-right">Reps</span><span />
            </div>
            <ol className="px-1.5">
              {Array.from({ length: ex.sets }, (_, i) => {
                const d = ex.done[i], p = ex.prev[i];
                const state = i === edit ? "edit" : d ? "done" : i === k ? "current" : "next";
                const shown = state === "current" || state === "edit" ? draft : d ?? { kg: ex.kg, reps: ex.reps }; // à venir : l'objectif, en gris
                return (
                  <li key={i}>
                    <button
                      type="button"
                      disabled={state === "next"}
                      onClick={() => pickRow(i)}
                      className={cn(
                        "grid h-12 w-full touch-manipulation items-center gap-2 rounded-xl px-1.5 text-left transition-colors duration-200",
                        ROW,
                        state === "done" && "bg-good/[0.07]",
                        (state === "current" || state === "edit") && "bg-surface-2 ring-1 ring-inset ring-brand/60",
                        state === "next" && "text-ink-mute",
                      )}
                    >
                      <span className="grid size-7 place-items-center rounded-full bg-surface-2 font-num text-sm font-semibold tabular-nums">{i + 1}</span>
                      <span className="truncate font-num text-sm tabular-nums text-ink-mute">{p ? `${kgTxt(p.kg, ex.bodyweight)} × ${p.reps}` : "—"}</span>
                      <span className="text-right font-num text-metric-sm tabular-nums">{shown ? kgTxt(shown.kg, ex.bodyweight) : "–"}</span>
                      <span className="text-right font-num text-metric-sm tabular-nums">{shown ? shown.reps : "–"}</span>
                      <span className="grid place-items-center">
                        {d && state !== "edit" ? (
                          <span className="grid size-7 animate-pop place-items-center rounded-full bg-good text-black/80"><Check className="size-4" strokeWidth={3} aria-hidden /></span>
                        ) : (
                          <span className={cn("size-7 rounded-full border-2", state === "current" || state === "edit" ? "border-brand/70" : "border-line")} />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Saisie de la série en cours (ou correction) */}
          {!complete && (
            <div className="mt-4 space-y-2">
              <NumberStepper
                label={ex.bodyweight ? "Lest" : "Charge"}
                value={draft.kg}
                step={ex.step}
                max={400}
                format={(v) => kgTxt(v, ex.bodyweight)}
                unit={ex.bodyweight ? (draft.kg ? "kg de lest" : "poids du corps") : "kg"}
                onChange={(kg) => setDraft((s) => ({ ...s, kg }))}
              />
              <NumberStepper label={ex.timed ? "Durée" : "Répétitions"} value={draft.reps} max={ex.timed ? 600 : 100} step={ex.timed ? 5 : 1} unit={ex.timed ? "s" : "reps"} onChange={(reps) => setDraft((s) => ({ ...s, reps }))} />
              {ex.prev[edit ?? k] && (
                <button
                  type="button"
                  onClick={() => { tap(6); setDraft({ ...ex.prev[edit ?? k] }); }}
                  className={cn(ui.chip, "h-9 touch-manipulation px-3 transition active:scale-95 active:bg-surface-3")}
                >
                  <History className="size-3.5" aria-hidden />
                  Reprendre la séance précédente : {kgTxt(ex.prev[edit ?? k].kg, ex.bodyweight)}{ex.bodyweight ? "" : " kg"} × {ex.prev[edit ?? k].reps}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Action principale, dans la zone du pouce ── */}
        <footer className="border-t border-line/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {complete ? (
            <button type="button" onClick={() => { tap(10); setExs((l) => l.map((e, i) => (i === idx ? { ...e, sets: e.sets + 1 } : e))); }} className={cn(ui.btnSecondary, "h-16 w-full text-lg")}>
              <Plus className="size-6" aria-hidden />Ajouter une série
            </button>
          ) : (
            <button
              type="button"
              onClick={validate}
              className={cn(ui.btnPrimary, "h-16 w-full text-lg", flash && "bg-good shadow-none")}
            >
              <Check className={cn("size-6", flash && "animate-pop")} strokeWidth={3} aria-hidden />
              {flash ? "Série validée" : edit != null ? `Corriger la série ${edit + 1}` : `Valider la série ${k + 1}`}
            </button>
          )}
        </footer>
      </div>

      {rest && (
        <RestOverlay
          {...rest}
          onAdd={(s) => setRest((r) => r && { ...r, endsAt: r.endsAt + s * 1000, total: r.total + s * 1000 })}
          onDone={() => setRest(null)}
        />
      )}

      <ConfirmSheet
        open={quit}
        onClose={() => setQuit(false)}
        onConfirm={onExit}
        title="Quitter la séance ?"
        message={`${doneSets} série${doneSets > 1 ? "s" : ""} validée${doneSets > 1 ? "s" : ""} : elles restent sur ce téléphone, tu pourras reprendre.`}
        confirmLabel="Quitter"
        cancelLabel="Continuer la séance"
        destructive
      />

      <BottomSheet open={finished} onClose={() => setFinished(false)} title="Séance terminée">
        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Metric size="lg" label="Durée" value={Math.max(1, Math.round(elapsed / 60))} unit="min" />
          <Metric size="lg" label="Séries" value={doneSets} unit={`/ ${totalSets}`} />
          <Metric size="lg" label="Volume" value={fmtNum(volume / 1000, 1)} unit="t" />
        </dl>
        {templateName !== undefined && (
          <div className="mt-4">
            <Switch checked={tplOn} onChange={setTplOn} label="Enregistrer comme modèle" description="Exercices, séries et repos, sans tes performances." />
            {tplOn && (
              <label className="mt-2 block">
                <span className={ui.label}>Nom du modèle</span>
                <input
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  maxLength={60}
                  autoComplete="off"
                  enterKeyHint="done"
                  className="mt-1 h-14 w-full rounded-tile bg-surface px-4 text-base font-semibold text-ink caret-brand outline-none ring-1 ring-inset ring-line focus-visible:ring-brand"
                />
              </label>
            )}
          </div>
        )}
        {saveErr && <p role="alert" className="mt-3 text-sm font-medium text-bad">{saveErr}</p>}
        <div className="mt-6 grid gap-2">
          <button type="button" disabled={saving} onClick={save} className={cn(ui.btnPrimary, "w-full")}>{saving ? "Enregistrement…" : "Enregistrer la séance"}</button>
          <button type="button" disabled={saving} onClick={() => setFinished(false)} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>Revenir à la séance</button>
        </div>
      </BottomSheet>
    </div>
  );
}

/** Repos en plein écran : chiffres de 88 px lisibles téléphone posé au sol, anneau de progression, contrôles sous le pouce. */
function RestOverlay({ endsAt, total, next, onAdd, onDone }: { endsAt: number; total: number; next: string; onAdd: (s: number) => void; onDone: () => void }) {
  const now = useNow();
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const done = useRef(false);
  useEffect(() => {
    if (left > 0 || done.current) return;
    done.current = true;
    restOver();
    beep();
    onDone();
  }, [left, onDone]);
  const R = 46, C = 2 * Math.PI * R, frac = Math.min(1, (left * 1000) / total);

  return (
    <div role="timer" aria-live="off" aria-label={`Repos : ${fmtClock(left)}`} className="fixed inset-0 z-[60] animate-fade-up bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-md flex-col px-6 pt-safe-top">
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className={ui.label}>Repos</p>
          <div className="relative mt-5 size-64">
            <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
              <circle cx="50" cy="50" r={R} className="fill-none stroke-surface-2" strokeWidth="4" />
              <circle
                cx="50" cy="50" r={R}
                className="fill-none stroke-brand transition-[stroke-dashoffset] duration-300 ease-linear"
                strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center font-num text-[88px] font-semibold leading-none tabular-nums">{fmtClock(left)}</span>
          </div>
          <p className="mt-8 text-center text-sm text-ink-soft">
            Ensuite · <span className="font-semibold text-ink">{next}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button type="button" onClick={() => { tap(8); onAdd(15); }} className={ui.btnSecondary}>+15 s</button>
          <button type="button" onClick={() => { tap(12); onDone(); }} className={ui.btnPrimary}>
            <SkipForward className="size-5" fill="currentColor" aria-hidden />Passer
          </button>
        </div>
      </div>
    </div>
  );
}
