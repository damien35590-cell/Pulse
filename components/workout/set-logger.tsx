"use client";
import { useEffect, useRef, useState } from "react";
import { animate, AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Check, History, Minus, MoreHorizontal, Plus, SkipForward, Target, Timer, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { beep, restOver, tap } from "@/lib/haptics";
import { fmtClock, fmtNum } from "@/lib/format";
import { NumberStepper } from "@/components/ui/number-stepper";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { Metric } from "@/components/ui/metric";
import { Switch } from "@/components/ui/switch";
import { HrPill, zoneText } from "@/components/workout/hr-pill";
import { CodeBadge } from "@/components/workout/catalog-bits";
import { useHeartRate } from "@/stores/heart-rate";
import { useWakeLock } from "@/lib/use-wake-lock";
import { nextVerdict, type NextVerdict } from "@/lib/workout/next-target";
import type { PastRow } from "@/lib/workout/types";

/**
 * `at` : instant de validation (ms) ; `restS` : repos réellement pris ensuite (s). Servent à relier la FC à la série (lib/workout/hr.ts).
 * `hard` : série marquée « Dur » (ressenti), envoyée au coach ; n'entre pas dans la progression.
 */
export type LiftSet = { reps: number; kg: number; at?: number; restS?: number; hard?: boolean };
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
  /** Lafay : séances passées de l'échelle, pour le verdict « prochaine fois » en fin d'exercice (lib/workout/next-target.ts). */
  past?: PastRow[];
  done: LiftSet[];
};

type Props = {
  title: string;
  program?: string;
  exercises: LiftExercise[];
  startedAt?: number;
  /** Quitter sans terminer : les séries validées restent sur le téléphone, la séance se reprend plus tard. */
  onExit: () => void;
  /** « Abandonner la séance » : rien n'est enregistré, la séance en cours est effacée du téléphone. Par défaut : onExit. */
  onDiscard?: () => void;
  /**
   * Enregistre la séance. Si fournie, c'est elle qui termine (navigation comprise) ; une erreur levée garde la feuille ouverte.
   * Sans elle, « Enregistrer » quitte simplement.
   */
  onSave?: (exercises: LiftExercise[], opts: { templateName?: string }) => Promise<void> | void;
  /** Appelé à chaque série validée ou corrigée : de quoi reprendre la séance après un appel ou un rafraîchissement. */
  onChange?: (exercises: LiftExercise[]) => void;
  /** Nom proposé pour « Enregistrer comme modèle » ; sans lui, l'option n'apparaît pas. */
  templateName?: string;
  /** FC max de l'utilisateur : colore la FC en direct aux couleurs des zones. */
  hrMax?: number | null;
  /** Ceinture cardio Bluetooth, écran allumé et retour Android intercepté. Faux pour la démo de /ui-kit. */
  liveHr?: boolean;
};

type Rest = { endsAt: number; total: number; next: string; startedAt: number; after: { ex: number; set: number }; hrStart: number | null };
/** Fin d'exercice : coche tamponnée (« stamp »), puis bandeau résumé (« strip »), puis exercice suivant (ou fin de séance si next < 0). */
type Wrap = { ex: number; next: number; rest: Rest | null; phase: "stamp" | "strip" };

const fr = (v: number) => fmtNum(v, 2);
const kgTxt = (kg: number, bw?: boolean) => (bw ? (kg ? `+${fr(kg)}` : "PDC") : fr(kg));
/** Colonnes de la partie « ligne » d'une série (n°, précédent, kg, reps) ; « Dur » (w-12) et la coche (w-14) suivent. */
const ROW = "grid-cols-[2rem_minmax(0,1fr)_3.5rem_2.75rem]";
const STAMP_MS = 280, WRAP_MS = 1500;
const sumReps = (l: LiftSet[]) => l.reduce((s, d) => s + d.reps, 0);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "=");

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
 * - Tout ce qui se touche fait ≥ 48 px (56 px pour la coche), l'action principale (64 px) est en bas, sous le pouce.
 * - La série est pré-remplie (dernière série faite, sinon l'objectif) : la plupart du temps, 1 seul tap suffit.
 * - Retour immédiat : vibration + bouton qui passe au vert + coche qui « pop » dans le tableau, puis repos.
 * - Fin d'exercice : coche tamponnée, bandeau résumé (séries, reps, écart, verdict Lafay), puis l'exercice suivant glisse.
 */
export function SetLogger({ title, program, exercises, startedAt, onExit, onDiscard, onSave, onChange, templateName, hrMax, liveHr = true }: Props) {
  const [exs, setExs] = useState(() => exercises.map((e) => ({ ...e, done: [...e.done] })));
  const [idx, setIdx] = useState(() => Math.max(0, exercises.findIndex((e) => e.done.length < e.sets)));
  const [edit, setEdit] = useState<number | null>(null); // série déjà faite en cours de correction
  const [draft, setDraft] = useState<LiftSet>({ reps: 0, kg: 0 });
  const [flash, setFlash] = useState(false);
  const [rest, setRest] = useState<Rest | null>(null);
  const [wrap, setWrap] = useState<Wrap | null>(null);
  const [menu, setMenu] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tplOn, setTplOn] = useState(false);
  const [tplName, setTplName] = useState(templateName ?? "");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const start = useRef(startedAt ?? Date.now());
  const wrapRef = useRef<Wrap | null>(null);
  const timers = useRef<number[]>([]);
  const slid = useRef(false); // le premier exercice s'affiche sans glisser
  const reduce = useReducedMotion() ?? false;
  const now = useNow();
  useWakeLock(liveHr);
  useEffect(() => {
    if (!liveHr) return;
    const hr = useHeartRate.getState();
    hr.begin(String(start.current), start.current);
    return () => hr.detach();
  }, [liveHr]);
  useEffect(() => { slid.current = true; }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // Retour Android pendant la séance : une entrée d'historique « garde » ; le retour la consomme et ouvre le menu au lieu de quitter.
  useEffect(() => {
    if (!liveHr) return;
    if (!window.history.state?.pulseGuard) window.history.pushState({ pulseGuard: true }, "");
    const onPop = () => {
      window.history.pushState({ pulseGuard: true }, "");
      tap(8);
      setMenu(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [liveHr]);

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
    setDraft(last ? { reps: last.reps, kg: last.kg } : { reps: e.reps, kg: e.kg });
    setEdit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  function pickRow(i: number) {
    if (i > k) return;
    tap(6);
    if (i === k) { setEdit(null); return; }
    setEdit(i);
    setDraft({ reps: ex.done[i].reps, kg: ex.done[i].kg });
  }

  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)); };
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  function validate() {
    if (flash || wrap) return; // anti double tap
    // Une série corrigée garde son instant de validation, son repos et sa marque « Dur » : la FC reste rattachée à la bonne fenêtre.
    if (edit != null) {
      tap(18);
      const old = ex.done[edit], set: LiftSet = { ...draft, at: old.at, restS: old.restS, ...(old.hard ? { hard: true } : {}) };
      setExs((l) => l.map((e, i) => (i === idx ? { ...e, done: e.done.map((d, j) => (j === edit ? set : d)) } : e)));
      setEdit(null);
      return;
    }
    const at = Date.now(), set: LiftSet = { reps: draft.reps, kg: draft.kg, at };
    const next = exs.map((e, i) => (i === idx ? { ...e, done: [...e.done, set] } : e));
    setExs(next);
    setFlash(true);
    const cur = next[idx];
    const nextIdx = cur.done.length < cur.sets ? idx : next.findIndex((e) => e.done.length < e.sets);
    const restFrom = (from: number): Rest | null => {
      const t = next[nextIdx];
      // Dernière série de l'exercice : repos « après exercice » ; sinon repos entre séries.
      const restS = nextIdx !== idx ? cur.restAfterS ?? cur.restS : cur.restS;
      if (!t || restS <= 0) return null;
      return { endsAt: from + restS * 1000, total: restS * 1000, next: `${t.name} · série ${t.done.length + 1}/${t.sets}`, startedAt: from, after: { ex: idx, set: cur.done.length - 1 }, hrStart: liveHr ? useHeartRate.getState().recentPeak(10) : null };
    };

    if (nextIdx !== idx) {
      // Fin d'exercice : vibration sèche, coche tamponnée, puis bandeau résumé. Le repos court dès maintenant, affiché après la transition.
      tap(40);
      const w: Wrap = { ex: idx, next: nextIdx, rest: restFrom(at), phase: "stamp" };
      wrapRef.current = w;
      setWrap(w);
      later(() => setWrap((x) => (x ? (wrapRef.current = { ...x, phase: "strip" }) : x)), reduce ? 0 : STAMP_MS);
      later(endWrap, WRAP_MS);
      return;
    }
    tap(18);
    later(() => {
      setFlash(false);
      const r = restFrom(Date.now());
      if (r) setRest(r);
    }, 600);
  }

  /** Fin de la transition (au bout de 1,5 s, ou au toucher) : exercice suivant, puis repos ; ou feuille de fin de séance. */
  function endWrap() {
    const w = wrapRef.current;
    if (!w) return;
    clearTimers();
    wrapRef.current = null;
    setWrap(null);
    setFlash(false);
    if (w.next < 0) { setFinished(true); return; }
    setIdx(w.next);
    const r = w.rest;
    if (r) later(() => setRest(r), reduce ? 0 : 350); // laisse le temps à l'exercice suivant de glisser
  }

  /** Coche de la dernière série validée : la dé-valide (valeurs gardées dans la saisie) et annule son repos. */
  function unvalidate() {
    const i = ex.done.length - 1, d = ex.done[i];
    if (!d || wrap) return;
    tap(10);
    clearTimers();
    setFlash(false);
    setExs((l) => l.map((e, j) => (j === idx ? { ...e, done: e.done.slice(0, -1) } : e)));
    setEdit(null);
    setDraft({ reps: d.reps, kg: d.kg });
    if (rest && rest.after.ex === idx && rest.after.set === i) setRest(null);
  }

  function toggleHard(exI: number, setI: number) {
    tap(8);
    setExs((l) => l.map((e, i) => (i === exI ? { ...e, done: e.done.map((d, j) => (j === setI ? { ...d, hard: !d.hard } : d)) } : e)));
  }

  /** Ferme le repos et note sa durée réelle sur la série qui l'a déclenché. */
  function endRest(r: Rest) {
    const took = Math.round((Date.now() - r.startedAt) / 1000);
    setRest(null);
    if (took < 1) return;
    setExs((l) => l.map((e, i) => (i === r.after.ex ? { ...e, done: e.done.map((d, j) => (j === r.after.set ? { ...d, restS: took } : d)) } : e)));
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
  const strip = wrap?.phase === "strip" && wrap.ex === idx;
  const restHard = rest ? exs[rest.after.ex]?.done[rest.after.set]?.hard ?? false : false;

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col">
        {/* ── En-tête : menu / titre + chrono / terminer ── */}
        <header className="pt-safe-top">
          <div className="flex h-14 items-center gap-1 px-1">
            <button type="button" onClick={() => { tap(8); setMenu(true); }} aria-label="Options de la séance" className={ui.iconBtn}>
              <MoreHorizontal className="size-6" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="truncate text-[15px] font-semibold leading-tight">{title}</p>
              <p className="font-num text-sm tabular-nums text-ink-mute">
                {fmtClock(elapsed)} · {doneSets}/{totalSets} séries
              </p>
            </div>
            {liveHr && <HrPill hrMax={hrMax} />}
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

        {/* ── Corps défilant : l'exercice suivant glisse depuis la droite ── */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 pb-4">
          <motion.div
            key={idx}
            initial={slid.current ? (reduce ? { opacity: 0 } : { opacity: 0, x: 24 }) : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <p className={ui.label}>{program ? `${program} · ` : ""}Exercice {idx + 1}/{exs.length}</p>
            <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight">{ex.name}</h1>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className={ui.chip}><Target className="size-3.5" aria-hidden />{ex.sets} × {ex.reps}{ex.timed ? " s" : ""} · {kgTxt(ex.kg, ex.bodyweight)}{ex.bodyweight ? "" : " kg"}</span>
              <span className={ui.chip}><Timer className="size-3.5" aria-hidden />Repos {fmtClock(ex.restS)}</span>
              {gain > 0 && <span className={cn(ui.chip, "bg-good/15 text-good")}><TrendingUp className="size-3.5" aria-hidden />+{fr(gain)} kg vs dernière fois</span>}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {strip ? (
                <WrapStrip key="strip" ex={ex} reduce={reduce} />
              ) : (
                <motion.div
                  key="table"
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0.35 }}
                  style={{ originY: 0 }}
                  transition={{ duration: 0.18, ease: "easeIn" }}
                >
                  {/* Tableau des séries (schéma Strong / Hevy) : précédent → réalisé, une ligne = une série */}
                  <div className={cn(ui.card, "mt-5 pb-1.5")}>
                    <div className="flex items-center px-1.5 pb-1 pt-3 text-label uppercase text-ink-mute">
                      <div className={cn("grid flex-1 items-center gap-1.5 px-1.5", ROW)}>
                        <span>Série</span><span>Précédent</span><span className="text-right">kg</span><span className="text-right">Reps</span>
                      </div>
                      <span className="w-12" />
                      <span className="w-14" />
                    </div>
                    <ol className="px-1.5">
                      {Array.from({ length: ex.sets }, (_, i) => {
                        const d = ex.done[i], p = ex.prev[i];
                        const state = i === edit ? "edit" : d ? "done" : i === k ? "current" : "next";
                        const shown = state === "current" || state === "edit" ? draft : d ?? { kg: ex.kg, reps: ex.reps }; // à venir : l'objectif, en gris
                        const lastDone = !!d && i === k - 1 && state !== "edit";
                        const stamped = !!wrap && wrap.ex === idx && i === k - 1;
                        return (
                          <li
                            key={i}
                            className={cn(
                              "flex h-14 items-center rounded-xl transition-colors duration-200",
                              state === "done" && "bg-good/[0.07]",
                              (state === "current" || state === "edit") && "bg-surface-2 ring-1 ring-inset ring-brand/60",
                              state === "next" && "text-ink-mute",
                            )}
                          >
                            <button
                              type="button"
                              disabled={state === "next"}
                              onClick={() => pickRow(i)}
                              aria-label={`Série ${i + 1}${d ? ", modifier" : ""}`}
                              className={cn("grid h-full min-w-0 flex-1 touch-manipulation items-center gap-1.5 px-1.5 text-left", ROW)}
                            >
                              <span className="grid size-7 place-items-center rounded-full bg-surface-2 font-num text-sm font-semibold tabular-nums">{i + 1}</span>
                              <span className="truncate font-num text-sm tabular-nums text-ink-mute">{p ? `${kgTxt(p.kg, ex.bodyweight)} × ${p.reps}` : "—"}</span>
                              <span className="text-right font-num text-metric-sm tabular-nums">{shown ? kgTxt(shown.kg, ex.bodyweight) : "–"}</span>
                              <span className="text-right font-num text-metric-sm tabular-nums">{shown ? shown.reps : "–"}</span>
                            </button>
                            {/* « Dur » : seulement sur une série validée, jusqu'à la fin de la séance */}
                            <span className="grid h-full w-12 place-items-center">
                              {d && <HardChip on={!!d.hard} onClick={() => toggleHard(idx, i)} label={`Série ${i + 1} dure`} />}
                            </span>
                            <CheckCell
                              state={state === "edit" ? "current" : state}
                              stamped={stamped}
                              reduce={reduce}
                              onClick={state === "current" || state === "edit" ? validate : lastDone ? unvalidate : undefined}
                              label={state === "current" || state === "edit" ? `Valider la série ${i + 1}` : lastDone ? `Annuler la validation de la série ${i + 1}` : undefined}
                            />
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
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Action principale, dans la zone du pouce ── */}
        <footer className="border-t border-line/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          {complete && !flash ? (
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
              {wrap ? "Exercice terminé" : flash ? "Série validée" : edit != null ? `Corriger la série ${edit + 1}` : `Valider la série ${k + 1}`}
            </button>
          )}
        </footer>
      </div>

      {/* Transition de fin d'exercice : un toucher n'importe où la passe */}
      {wrap && <button type="button" aria-label={wrap.next < 0 ? "Voir le bilan de la séance" : "Passer à l’exercice suivant"} onClick={endWrap} className="fixed inset-0 z-[55] cursor-default touch-manipulation" />}

      {rest && (
        <RestOverlay
          {...rest}
          onAdd={(s) => setRest((r) => r && { ...r, endsAt: r.endsAt + s * 1000, total: r.total + s * 1000 })}
          hrMax={hrMax}
          hard={restHard}
          onHard={() => toggleHard(rest.after.ex, rest.after.set)}
          onDone={() => endRest(rest)}
        />
      )}

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Séance en cours">
        <p className="mt-1 text-sm text-ink-soft">
          {doneSets} série{doneSets > 1 ? "s" : ""} validée{doneSets > 1 ? "s" : ""} sur {totalSets}.
        </p>
        <div className="mt-6 grid gap-2">
          <button type="button" onClick={() => setMenu(false)} className={cn(ui.btnPrimary, "w-full")}>Continuer</button>
          <button type="button" onClick={() => { setMenu(false); setFinished(true); }} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>Terminer et enregistrer</button>
          <button type="button" onClick={() => { setMenu(false); setDiscard(true); }} className={cn(ui.btnDanger, "w-full")}>Abandonner la séance</button>
          <button type="button" onClick={() => { setMenu(false); onExit(); }} className="h-12 w-full touch-manipulation rounded-full text-sm font-medium text-ink-soft transition active:scale-[0.97] active:bg-surface-3">
            Quitter et reprendre plus tard
          </button>
        </div>
      </BottomSheet>

      <ConfirmSheet
        open={discard}
        onClose={() => setDiscard(false)}
        onConfirm={() => (onDiscard ?? onExit)()}
        title="Abandonner la séance ?"
        message={`Rien ne sera enregistré${doneSets ? ` : tes ${doneSets} série${doneSets > 1 ? "s" : ""} validée${doneSets > 1 ? "s" : ""} seront effacées` : ""}, et la progression ne bougera pas.`}
        confirmLabel="Abandonner"
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

/** Pastille « Dur » : cible de 48 px, pastille de 28 px ; activée = teinte `warn`. */
function HardChip({ on, onClick, label, big }: { on: boolean; onClick: () => void; label: string; big?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} className={cn("grid touch-manipulation place-items-center transition active:scale-90", big ? "h-12 px-1" : "size-12")}>
      <span className={cn(ui.chip, big ? "h-9 px-4 text-sm" : "px-2", on && "bg-warn/15 text-warn")}>Dur</span>
    </button>
  );
}

/** Coche d'une série : bouton de 56 px sur la série en cours (valider) et sur la dernière validée (annuler) ; tamponnée en fin d'exercice. */
function CheckCell({ state, stamped, reduce, onClick, label }: { state: "done" | "current" | "next"; stamped: boolean; reduce: boolean; onClick?: () => void; label?: string }) {
  const mark = state === "done" ? (
    <motion.span
      initial={stamped && !reduce ? { scale: 1.3 } : false}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 700, damping: 18 }}
      className={cn("grid size-8 place-items-center rounded-full bg-good text-black/80", !stamped && "animate-pop")}
    >
      <Check className="size-4" strokeWidth={3} aria-hidden />
    </motion.span>
  ) : (
    <span className={cn("size-8 rounded-full border-2", state === "current" ? "border-brand/70" : "border-line")} />
  );
  if (!onClick) return <span className="grid h-full w-14 shrink-0 place-items-center">{mark}</span>;
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-14 shrink-0 touch-manipulation place-items-center rounded-full transition active:scale-90">
      {mark}
    </button>
  );
}

/** Total qui défile de 0 à `to` (~400 ms) ; direct si mouvement réduit. */
function CountUp({ to, reduce }: { to: number; reduce: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) { el.textContent = String(to); return; }
    const c = animate(0, to, { duration: 0.4, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => { el.textContent = String(Math.round(v)); } });
    return () => c.stop();
  }, [to, reduce]);
  return <span ref={ref}>{reduce ? to : 0}</span>;
}

const VERDICT_ICON: Record<NextVerdict["tone"], typeof TrendingUp> = { up: TrendingUp, same: Minus, down: TrendingDown, evolve: ArrowUpRight };

/** Bandeau de fin d'exercice : code + nom, « 6 séries · 47 reps · +3 », verdict pour la prochaine fois, trait Volt qui balaie. */
function WrapStrip({ ex, reduce }: { ex: LiftExercise; reduce: boolean }) {
  const total = sumReps(ex.done), before = ex.prev.length ? sumReps(ex.prev) : null, delta = before == null ? null : total - before;
  const m = /^([A-Z]\d*) - (.+)$/.exec(ex.name);
  const verdict = nextVerdict(ex), Icon = verdict ? VERDICT_ICON[verdict.tone] : null;
  // Record : plus que toutes les séances connues de l'exercice (au moins une).
  const known = [before ?? 0, ...(ex.past ?? []).map((r) => (r.setsDetail ? r.setsDetail.filter((s) => s.done).reduce((s, d) => s + d.reps, 0) : r.sets * r.reps))];
  const record = (before != null || !!ex.past?.length) && total > Math.max(...known);
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(ui.card, "relative mt-5 overflow-hidden p-4")}
      role="status"
    >
      <div className="flex items-center gap-2.5">
        {m && <CodeBadge code={m[1]} />}
        <p className="min-w-0 flex-1 truncate font-semibold">{m ? m[2] : ex.name}</p>
        {record && <span className={cn(ui.chip, "bg-good/15 text-good")}>Record</span>}
      </div>
      <p className="mt-2 font-num text-metric-sm tabular-nums">
        {ex.done.length} séries · <CountUp to={total} reduce={reduce} /> {ex.timed ? "s" : "reps"}
        {delta != null && <span className={cn(delta > 0 ? "text-good" : delta < 0 ? "text-bad" : "text-ink-mute")}> · {signed(delta)}</span>}
      </p>
      {verdict && Icon && (
        <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
          <Icon className="size-4 shrink-0" aria-hidden />
          {verdict.text}
        </p>
      )}
      <motion.span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-brand"
        initial={{ scaleX: reduce ? 1 : 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 }}
      />
    </motion.div>
  );
}

/** Repos en plein écran : chiffres de 88 px lisibles téléphone posé au sol, anneau de progression, contrôles sous le pouce. */
function RestOverlay({ endsAt, total, next, hrStart, hrMax, hard, onHard, onAdd, onDone }: { endsAt: number; total: number; next: string; hrStart: number | null; hrMax?: number | null; hard: boolean; onHard: () => void; onAdd: (s: number) => void; onDone: () => void }) {
  const now = useNow();
  const bpm = useHeartRate((s) => (s.status === "connected" ? s.bpm : null));
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
          {hrStart != null && bpm != null && (
            <p aria-label={`Fréquence cardiaque : ${hrStart} puis ${bpm} battements par minute`} className="mt-6 flex items-baseline gap-2 font-num text-metric-md tabular-nums">
              <span className="text-ink-soft">{hrStart}</span>
              <span aria-hidden className="text-ink-mute">→</span>
              <span className={zoneText(bpm, hrMax)}>{bpm}</span>
              <span className="font-sans text-xs font-medium text-ink-soft">bpm</span>
            </p>
          )}
          <div className="mt-4">
            <HardChip big on={hard} onClick={onHard} label="Série précédente dure" />
          </div>
          <p className="mt-4 text-center text-sm text-ink-soft">
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
