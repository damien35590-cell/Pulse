"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, MoreHorizontal, Pause, Pencil, Play, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { fmtClock } from "@/lib/format";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { NumberStepper } from "@/components/ui/number-stepper";
import { elapsedOf, finishWarmup, runItem, WARMUP_MAX_ITEMS, WARMUP_MAX_MIN, WARMUP_NAME_MAX, type WarmupLive, type WarmupLiveItem } from "@/lib/workout/warmup";

type Props = {
  title: string;
  /** Début de la séance (ms) : l'échauffement en fait partie, l'horloge d'en-tête court depuis lui. */
  startedAt: number;
  warmup: WarmupLive;
  onChange: (w: WarmupLive) => void;
  /** Échauffement fini ou passé : la séance passe au premier exercice. */
  onDone: (w: WarmupLive) => void;
  /** Menu « ⋯ » de la séance (continuer, abandonner, reprendre plus tard). */
  onMenu: () => void;
  /** Pastille FC de l'en-tête (la FC est enregistrée pendant l'échauffement, sans être affichée ensuite). */
  hr?: ReactNode;
  /** Libellé de fin (« Commencer le test » pour le test de niveau). */
  startLabel?: string;
};

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * Échauffement en début de séance : un chrono par élément (corde à sauter, gym / mobilité…), qui compte vers le haut avec la durée visée.
 * Objectif atteint : vibration légère + barre et chrono qui passent au vert, sans son ; le chrono continue. Cibles de 56 px, action principale en bas (`h-16`).
 * « Passer l'échauffement » : un tap, rien n'est enregistré.
 */
export function WarmupBlock({ title, startedAt, warmup, onChange, onDone, onMenu, hr, startLabel = "Commencer la séance" }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [edit, setEdit] = useState<{ id: string | null; name: string; min: number } | null>(null); // id null = nouvel élément
  const [removing, setRemoving] = useState<WarmupLiveItem | null>(null);
  const items = warmup.items;
  const running = items.find((x) => x.since != null) ?? null;
  // Objectifs déjà atteints à l'ouverture (reprise) : pas de vibration en retard.
  const reached = useRef(new Set(items.filter((x) => elapsedOf(x, Date.now()) >= x.targetS).map((x) => x.id)));

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!running || reached.current.has(running.id) || elapsedOf(running, now) < running.targetS) return;
    reached.current.add(running.id);
    tap(30);
  }, [running, now]);

  const set = (w: WarmupLive) => { setNow(Date.now()); onChange(w); };
  const toggle = (x: WarmupLiveItem) => { tap(12); set(runItem(warmup, x.since != null ? null : x.id, Date.now())); };
  const runIdx = running ? items.indexOf(running) : -1;
  const next = runIdx >= 0 ? items.slice(runIdx + 1).find((x) => elapsedOf(x, now) === 0) : null;
  const started = items.some((x) => elapsedOf(x, now) > 0 || x.since != null);

  function primary() {
    tap(20);
    if (running && next) return set(runItem(warmup, next.id, Date.now()));
    if (!started && items.length) return set(runItem(warmup, items[0].id, Date.now()));
    onDone(finishWarmup(warmup, Date.now()));
  }
  const label = running && next ? `Suivant : ${next.name}` : !started && items.length ? `Démarrer : ${items[0].name}` : startLabel;

  function saveEdit() {
    if (!edit) return;
    const name = edit.name.trim().slice(0, WARMUP_NAME_MAX);
    if (!name) return;
    tap(10);
    set(edit.id
      ? { ...warmup, items: items.map((x) => (x.id === edit.id ? { ...x, name, targetS: edit.min * 60 } : x)) }
      : { ...warmup, items: [...items, { id: newId(), name, targetS: edit.min * 60, elapsedS: 0, since: null }] });
    setEdit(null);
  }
  const remove = (x: WarmupLiveItem) => { tap(8); set({ ...warmup, items: items.filter((y) => y.id !== x.id) }); };

  const total = items.reduce((s, x) => s + elapsedOf(x, now), 0);

  return (
    <div className="mx-auto flex h-full max-w-md flex-col">
      <header className="pt-safe-top">
        <div className="flex h-14 items-center gap-1 px-1">
          <button type="button" onClick={() => { tap(8); onMenu(); }} aria-label="Options de la séance" className={ui.iconBtn}>
            <MoreHorizontal className="size-6" aria-hidden />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-[15px] font-semibold leading-tight">{title}</p>
            <p className="font-num text-sm tabular-nums text-ink-mute">{fmtClock(Math.max(0, Math.round((now - startedAt) / 1000)))} · échauffement</p>
          </div>
          {hr}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
        <p className={ui.label}>Avant le premier exercice</p>
        <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight">Échauffement</h1>
        <p className="mt-1 font-num text-sm tabular-nums text-ink-mute">
          {fmtClock(total)} au chrono · visé {Math.round(items.reduce((s, x) => s + x.targetS, 0) / 60)} min
        </p>

        <ol className="mt-4 space-y-2">
          {items.map((x) => <WarmupRow key={x.id} x={x} now={now} onToggle={() => toggle(x)} onEdit={() => { tap(6); setEdit({ id: x.id, name: x.name, min: Math.round(x.targetS / 60) }); }} onRemove={() => (elapsedOf(x, now) > 0 ? setRemoving(x) : remove(x))} />)}
        </ol>
        {items.length === 0 && <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>Plus rien dans l’échauffement : ajoute un élément ou commence la séance.</p>}
        {items.length < WARMUP_MAX_ITEMS && (
          <button type="button" onClick={() => { tap(6); setEdit({ id: null, name: "", min: 3 }); }} className={cn(ui.btnSecondary, "mt-3 w-full")}>
            <Plus className="size-5" aria-hidden />Ajouter un élément
          </button>
        )}
      </div>

      <footer className="space-y-1 border-t border-line/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <button type="button" onClick={() => { tap(10); onDone(finishWarmup(warmup, Date.now(), true)); }} className="h-14 w-full touch-manipulation rounded-full text-base font-semibold text-ink-soft transition active:scale-[0.97] active:bg-surface-2">
          Passer l’échauffement
        </button>
        <button type="button" onClick={primary} className={cn(ui.btnPrimary, "h-16 w-full text-lg")}>
          <Play className="size-6" fill="currentColor" aria-hidden />
          <span className="truncate">{label}</span>
        </button>
      </footer>

      <BottomSheet open={edit != null} onClose={() => setEdit(null)} title={edit?.id ? "Modifier l’élément" : "Ajouter à l’échauffement"}>
        {edit && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className={ui.label}>Nom</span>
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                maxLength={WARMUP_NAME_MAX}
                placeholder="Rameur, vélo, montées de genoux…"
                autoComplete="off"
                enterKeyHint="done"
                className="mt-1 h-14 w-full rounded-tile bg-surface px-4 text-base font-semibold text-ink caret-brand outline-none ring-1 ring-inset ring-line placeholder:font-normal placeholder:text-ink-mute focus-visible:ring-brand"
              />
            </label>
            <NumberStepper label="Durée visée" value={edit.min} min={1} max={WARMUP_MAX_MIN} unit="min" onChange={(min) => setEdit({ ...edit, min })} />
            <button type="button" disabled={!edit.name.trim()} onClick={saveEdit} className={cn(ui.btnPrimary, "w-full")}>{edit.id ? "Enregistrer" : "Ajouter"}</button>
          </div>
        )}
      </BottomSheet>

      <ConfirmSheet
        open={removing != null}
        onClose={() => setRemoving(null)}
        onConfirm={() => { if (removing) remove(removing); setRemoving(null); }}
        title={`Retirer « ${removing?.name ?? ""} » ?`}
        message="Son chrono ne sera pas enregistré avec la séance."
        confirmLabel="Retirer"
        cancelLabel="Garder"
        destructive
      />
    </div>
  );
}

/** Un élément : nom, durée visée, chrono (vert une fois l'objectif atteint), barre de progression, lecture / pause en 56 px. */
function WarmupRow({ x, now, onToggle, onEdit, onRemove }: { x: WarmupLiveItem; now: number; onToggle: () => void; onEdit: () => void; onRemove: () => void }) {
  const s = elapsedOf(x, now), on = x.since != null, hit = s >= x.targetS;
  return (
    <li className={cn(ui.card, "p-3 transition-shadow duration-200", on && "ring-1 ring-inset", on && (hit ? "ring-good/60" : "ring-brand/60"))}>
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1 pl-1 pt-1">
          <p className="truncate font-semibold">{x.name}</p>
          <p className="text-sm text-ink-mute">Objectif {fmtClock(x.targetS)}</p>
        </div>
        <button type="button" onClick={onEdit} aria-label={`Modifier ${x.name}`} className={cn(ui.iconBtn, "size-14 text-ink-soft")}><Pencil className="size-5" aria-hidden /></button>
        <button type="button" onClick={onRemove} aria-label={`Retirer ${x.name}`} className={cn(ui.iconBtn, "size-14 text-ink-soft")}><X className="size-5" aria-hidden /></button>
      </div>
      <div className="mt-1 flex items-center gap-3 pl-1">
        <div className="min-w-0 flex-1">
          <p role="timer" aria-label={`${x.name} : ${fmtClock(s)} sur ${fmtClock(x.targetS)}`} className="flex items-baseline gap-2">
            <span className={cn("font-num text-metric-xl tabular-nums leading-none", hit ? "text-good" : on ? "text-ink" : "text-ink-soft")}>{fmtClock(s)}</span>
            {hit && (
              <span className={cn(ui.chip, "animate-pop bg-good/15 text-good")}><Check className="size-3.5" strokeWidth={3} aria-hidden />Objectif atteint</span>
            )}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={cn("h-full rounded-full transition-[width] duration-300 ease-linear", hit ? "bg-good" : "bg-brand")} style={{ width: `${Math.min(1, s / x.targetS) * 100}%` }} />
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-label={on ? `Mettre ${x.name} en pause` : `Lancer le chrono : ${x.name}`}
          aria-pressed={on}
          className={cn("grid size-14 shrink-0 touch-manipulation place-items-center rounded-full transition active:scale-90", on ? "bg-ink text-bg" : "bg-surface-2 text-ink")}
        >
          {on ? <Pause className="size-6" fill="currentColor" aria-hidden /> : <Play className="size-6" fill="currentColor" aria-hidden />}
        </button>
      </div>
    </li>
  );
}
