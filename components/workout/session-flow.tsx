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
import { enqueuePending, isRetryable, newClientId, removePending } from "@/lib/workout/pending-uploads";
import { clearHrBuffer, useHeartRate } from "@/stores/heart-rate";
import type { Draft, Kind } from "@/lib/workout/types";

const STORE = "pulse-session-v2";
const MAX_AGE_MS = 12 * 3600 * 1000; // une séance laissée plus longtemps n'est plus reprise
const SESSION = "/record/session";

type Run = { clientId: string; title: string; kind: Kind; templateId: string | null; startedAt: number; exercises: LiftExercise[] };
type Phase = "boot" | "pick" | "conflict" | "prep" | "run";

const done = (r: Run | LiftExercise[]) => (Array.isArray(r) ? r : r.exercises).reduce((n, e) => n + e.done.length, 0);

/** La séance en cours sur ce téléphone, sans limite d'âge dès qu'elle a une série validée ; une séance vide de plus de 12 h est oubliée. */
function readStored(): Run | null {
  try {
    const r = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (r?.v === 2 && Array.isArray(r.exercises)) {
      if (done(r.exercises) > 0) return { ...r, clientId: typeof r.clientId === "string" ? r.clientId : newClientId() } as Run;
      if (Date.now() - r.startedAt >= MAX_AGE_MS) clearStored();
    }
  } catch { /* stockage indisponible ou illisible */ }
  return null;
}
const clearStored = () => {
  try {
    // La FC d'une séance abandonnée ou terminée part avec elle.
    const r = JSON.parse(localStorage.getItem(STORE) ?? "null");
    if (r?.startedAt) clearHrBuffer(String(r.startedAt));
    localStorage.removeItem(STORE);
  } catch { /* */ }
};

/**
 * Parcours d'une séance de muscu : feuille « Nouvelle séance » → préparation → SetLogger → enregistrement.
 * `draft` vient de l'adresse (?suggest, ?from, ?template, ?empty) ; sans lui, on reprend la séance en cours ou on ouvre la feuille.
 * `direct` saute la préparation (bouton « Démarrer » de la suggestion).
 */
export function SessionFlow({ draft, direct, hrMax }: { draft: Draft | null; direct: boolean; hrMax?: number | null }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("boot");
  const [run, setRun] = useState<Run | null>(null);
  const [stored, setStored] = useState<Run | null>(null);
  const [res, setRes] = useState<{ story: string; record: boolean; id: string } | null>(null);
  const latest = useRef<LiftExercise[]>([]);

  function startRun(d: Draft) {
    const r: Run = { clientId: newClientId(), title: d.title || freeTitle(new Date()), kind: d.kind, templateId: d.templateId, startedAt: Date.now(), exercises: d.exercises.map(toLift) };
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
    try { localStorage.setItem(STORE, JSON.stringify({ v: 2, clientId: run.clientId, title: run.title, kind: run.kind, templateId: run.templateId, startedAt: run.startedAt, exercises: exs })); } catch { /* stockage indisponible */ }
  }

  /** Quitter garde les séries validées sur le téléphone ; sans série, il n'y a rien à reprendre. `replace` : l'entrée « garde » du retour Android disparaît. */
  function quit() {
    if (done(latest.current) === 0) { useHeartRate.getState().discard(); clearStored(); }
    router.replace("/record");
  }

  /** Abandon : rien n'est enregistré (ni séance, ni progression), la séance en cours et sa FC sont effacées, y compris d'une file d'envoi. */
  function discard() {
    useHeartRate.getState().discard();
    clearStored();
    if (run) removePending(run.clientId).catch(() => null);
    router.replace("/record");
  }

  async function save(exs: LiftExercise[], opts: { templateName?: string }) {
    if (!run) return;
    const exercises = exs.filter((e) => e.done.length).map(toPayload);
    if (!exercises.length) throw new Error("Aucune série validée : valide au moins une série avant d’enregistrer.");
    // Avec une ceinture, la série de FC part avec la séance ; le serveur calcule moyenne, max, pic et récupération de chaque série.
    const hrSeries = useHeartRate.getState().samples;
    const body = {
        clientId: run.clientId, type: "WORKOUT", title: run.title, kind: run.kind, templateId: run.templateId, startedAt: new Date(run.startedAt).toISOString(),
        movingTimeS: Math.max(60, Math.round((Date.now() - run.startedAt) / 1000)), exercises, gearIds: [],
        ...(hrSeries.length ? { hrSeries } : {}),
    };
    let r: Response | null = null;
    try { r = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); } catch { /* pas de réseau */ }
    if (!r?.ok) {
      // Réseau coupé ou erreur serveur : la séance quitte le stockage de la séance en cours pour la file d'envoi (IndexedDB), qui la renvoie seule.
      if (!r || isRetryable(r.status)) {
        const queued = await enqueuePending({ clientId: run.clientId, body, title: run.title, templateName: opts.templateName }).then(() => true, () => false);
        if (queued) { try { localStorage.removeItem(STORE); } catch { /* */ } throw new Error("Impossible d’enregistrer pour l’instant. Séance gardée sur le téléphone, envoi automatique dès que possible."); }
      }
      throw new Error("Impossible d’enregistrer. Tes séries sont conservées : réessaie.");
    }
    const j = await r.json();
    await removePending(run.clientId).catch(() => null); // un essai précédent avait pu la mettre en file
    useHeartRate.getState().discard();
    clearStored();
    // Le modèle est un bonus : s'il échoue, la séance est enregistrée quand même.
    if (opts.templateName) await saveTemplate(j.id, opts.templateName).catch(() => null);
    setRes({ story: j.story, record: j.record, id: j.id });
  }

  if (res) return <StoryReveal story={res.story} record={res.record} onClose={() => { router.push(`/activities/${res.id}`); router.refresh(); }} />;
  if (phase === "run" && run) {
    return <SetLogger title={run.title} exercises={run.exercises} startedAt={run.startedAt} templateName={run.title} hrMax={hrMax} onChange={persist} onSave={save} onExit={quit} onDiscard={discard} />;
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
