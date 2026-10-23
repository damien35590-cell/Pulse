"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SetLogger, type LiftExercise } from "@/components/workout/set-logger";
import { PrepScreen } from "@/components/workout/prep-screen";
import { NewSessionSheet } from "@/components/workout/new-session-sheet";
import { StoryReveal } from "@/components/record/story-reveal";
import { saveTemplate } from "@/app/(app)/record/session/actions";
import { freeTitle, toLift, toPayload } from "@/lib/workout/lift";
import type { Draft, Kind } from "@/lib/workout/types";

const STORE = "pulse-session-v2";
const MAX_AGE_MS = 12 * 3600 * 1000; // une séance laissée plus longtemps n'est plus reprise
const SESSION = "/record/session";

type Run = { title: string; kind: Kind; templateId: string | null; startedAt: number; exercises: LiftExercise[] };
type Phase = "boot" | "pick" | "conflict" | "prep" | "run";

const done = (r: Run | LiftExercise[]) => (Array.isArray(r) ? r : r.exercises).reduce((n, e) => n + e.done.length, 0);

/** La séance en cours sur ce téléphone (au moins une série validée, moins de 12 h), sinon null. */
function readStored(): Run | null {
  try {
    const r = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (r?.v === 2 && Array.isArray(r.exercises) && Date.now() - r.startedAt < MAX_AGE_MS && done(r.exercises) > 0) return r as Run;
  } catch { /* stockage indisponible ou illisible */ }
  return null;
}
const clearStored = () => { try { localStorage.removeItem(STORE); } catch { /* */ } };

/**
 * Parcours d'une séance de muscu : feuille « Nouvelle séance » → préparation → SetLogger → enregistrement.
 * `draft` vient de l'adresse (?suggest, ?from, ?template, ?empty) ; sans lui, on reprend la séance en cours ou on ouvre la feuille.
 * `direct` saute la préparation (bouton « Démarrer » de la suggestion).
 */
export function SessionFlow({ draft, direct }: { draft: Draft | null; direct: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("boot");
  const [run, setRun] = useState<Run | null>(null);
  const [stored, setStored] = useState<Run | null>(null);
  const [res, setRes] = useState<{ story: string; record: boolean; id: string } | null>(null);
  const latest = useRef<LiftExercise[]>([]);

  function startRun(d: Draft) {
    const r: Run = { title: d.title || freeTitle(new Date()), kind: d.kind, templateId: d.templateId, startedAt: Date.now(), exercises: d.exercises.map(toLift) };
    latest.current = r.exercises;
    setRun(r);
    setPhase("run");
    window.history.replaceState(null, "", SESSION); // un rafraîchissement reprend la séance au lieu de reconstruire le brouillon
  }
  function resume(r: Run) {
    latest.current = r.exercises;
    setRun(r);
    setPhase("run");
    window.history.replaceState(null, "", SESSION);
  }

  useEffect(() => {
    const s = readStored();
    if (!draft) return s ? resume(s) : setPhase("pick");
    if (s) { setStored(s); return setPhase("conflict"); }
    clearStored();
    if (direct && draft.exercises.length) startRun(draft); else setPhase("prep");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(exs: LiftExercise[]) {
    latest.current = exs;
    if (!run) return;
    try { localStorage.setItem(STORE, JSON.stringify({ v: 2, title: run.title, kind: run.kind, templateId: run.templateId, startedAt: run.startedAt, exercises: exs })); } catch { /* stockage indisponible */ }
  }

  /** Quitter garde les séries validées sur le téléphone ; sans série, il n'y a rien à reprendre. */
  function quit() {
    if (done(latest.current) === 0) clearStored();
    router.push("/record");
  }

  async function save(exs: LiftExercise[], opts: { templateName?: string }) {
    if (!run) return;
    const exercises = exs.filter((e) => e.done.length).map(toPayload);
    if (!exercises.length) throw new Error("Aucune série validée : valide au moins une série avant d’enregistrer.");
    const r = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "WORKOUT", title: run.title, kind: run.kind, templateId: run.templateId, startedAt: new Date(run.startedAt).toISOString(),
        movingTimeS: Math.max(60, Math.round((Date.now() - run.startedAt) / 1000)), exercises, gearIds: [],
      }),
    });
    if (!r.ok) throw new Error("Impossible d’enregistrer. Tes séries sont conservées : réessaie.");
    const j = await r.json();
    clearStored();
    // Le modèle est un bonus : s'il échoue, la séance est enregistrée quand même.
    if (opts.templateName) await saveTemplate(j.id, opts.templateName).catch(() => null);
    setRes({ story: j.story, record: j.record, id: j.id });
  }

  if (res) return <StoryReveal story={res.story} record={res.record} onClose={() => { router.push(`/activities/${res.id}`); router.refresh(); }} />;
  if (phase === "run" && run) {
    return <SetLogger title={run.title} exercises={run.exercises} startedAt={run.startedAt} templateName={run.title} onChange={persist} onSave={save} onExit={quit} />;
  }
  if (phase === "prep" && draft) return <PrepScreen draft={draft} onStart={startRun} onBack={() => router.push(SESSION)} />;

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <NewSessionSheet open={phase === "pick"} onClose={() => { if (phase === "pick") router.push("/record"); }} />
      <BottomSheet open={phase === "conflict"} onClose={() => { if (phase === "conflict") router.push("/record"); }} title="Une séance est en cours">
        {stored && (
          <>
            <p className="mt-1 text-sm text-ink-soft">
              « {stored.title} » : {done(stored)} série{done(stored) > 1 ? "s" : ""} déjà validée{done(stored) > 1 ? "s" : ""}. Démarrer une nouvelle séance l’abandonne.
            </p>
            <div className="mt-6 grid gap-2">
              <button type="button" onClick={() => resume(stored)} className={cn(ui.btnPrimary, "w-full")}>Reprendre la séance</button>
              <button
                type="button"
                onClick={() => { clearStored(); setStored(null); if (draft && direct && draft.exercises.length) startRun(draft); else setPhase("prep"); }}
                className={cn(ui.btnSecondary, "w-full bg-surface-3")}
              >
                Commencer la nouvelle
              </button>
            </div>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
