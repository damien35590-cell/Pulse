"use client";
import { useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Info, Minus, Pencil, Play, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { fmtNum } from "@/lib/format";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NumberStepper } from "@/components/ui/number-stepper";
import { AddExerciseSheet } from "@/components/workout/add-exercise-sheet";
import { LAFAY_FAMILIES, catalogExercise, catalogFor, displayName, isLafayCode, nextInLadder, prevInLadder } from "@/lib/workout/catalog";
import { ExerciseDetail, ExerciseThumb } from "@/components/workout/catalog-bits";
import { musclesOfCode } from "@/lib/workout/body";
import type { Draft, DraftExercise } from "@/lib/workout/types";

/** « 8·8·8·7·6·5 = 42 » */
const lastTxt = (e: DraftExercise) => {
  const l = e.last;
  if (!l) return "première fois";
  const where = l.variant && l.variant !== e.variant ? ` en ${l.variant}` : "";
  const load = l.loadKg ? ` à ${fmtNum(l.loadKg, 2)} kg` : "";
  return `dernière fois${where} : ${l.reps.join("·")} = ${l.total}${load}`;
};
const loadTxt = (e: DraftExercise) => (e.loadKg == null ? "PDC" : `${fmtNum(e.loadKg, 2)} kg`);
const timed = (e: DraftExercise) => catalogFor(e.code, e.variant)?.mode === "time";
/** Sous-catégories d'une lettre Lafay qui ont plusieurs variantes : « Pompes serrées : A3 A4 A5 A6 A9 A12 ». */
const groupsOf = (code: string) => (LAFAY_FAMILIES.find((f) => f.letter === code)?.groups ?? []).filter((g) => g.progression.length > 1);

/**
 * Écran de préparation : on réordonne, retire, change de niveau, ajoute, puis « Démarrer » ouvre le SetLogger avec ces cibles.
 * Réordonner se fait avec des flèches (cibles de 48 px) : plus fiable au pouce qu'un glisser-déposer.
 */
export function PrepScreen({ draft, onStart, onBack }: { draft: Draft; onStart: (d: Draft) => void; onBack: () => void }) {
  const [list, setList] = useState(draft.exercises);
  const [editId, setEditId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [infoId, setInfoId] = useState<string | null>(null);

  const edit = list.find((e) => e.id === editId) ?? null;
  const patch = (id: string, p: Partial<DraftExercise>) => setList((l) => l.map((e) => (e.id === id ? { ...e, ...p } : e)));
  const setVariant = (e: DraftExercise, v: string) => { tap(8); patch(e.id, { variant: v, name: displayName(e.code, v), hint: null }); };
  const info = catalogExercise(infoId);
  const move = (i: number, to: number) => {
    tap(8);
    setList((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(to, 0, x); return n; });
  };
  const totalSets = list.reduce((s, e) => s + e.sets, 0);

  return (
    <div className="fixed inset-0 z-50 bg-bg">
      <div className="mx-auto flex h-full max-w-md flex-col">
        <header className="pt-safe-top">
          <div className="flex h-14 items-center gap-1 px-1">
            <button type="button" onClick={onBack} aria-label="Retour" className={ui.iconBtn}><ArrowLeft className="size-6" aria-hidden /></button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold leading-tight">{draft.title || "Séance vide"}</p>
              <p className="font-num text-sm tabular-nums text-ink-mute">{list.length} exercice{list.length > 1 ? "s" : ""} · {totalSets} séries</p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
          {list.length === 0 && <p className="rounded-card bg-surface p-4 text-sm text-ink-soft shadow-card">Aucun exercice pour l’instant : ajoute le premier ci-dessous.</p>}
          <ol className="space-y-2">
            {list.map((e, i) => (
              <li key={e.id} className={cn(ui.card, "flex items-stretch gap-1 p-1")}>
                <div className="flex flex-col justify-center">
                  <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Monter ${e.name}`} className={cn(ui.iconBtn, "disabled:opacity-30")}><ChevronUp className="size-6" aria-hidden /></button>
                  <button type="button" disabled={i === list.length - 1} onClick={() => move(i, i + 1)} aria-label={`Descendre ${e.name}`} className={cn(ui.iconBtn, "disabled:opacity-30")}><ChevronDown className="size-6" aria-hidden /></button>
                </div>
                <ExerciseThumb muscles={musclesOfCode(e.code, e.variant)} className="mr-2 self-center" />
                <div className="min-w-0 flex-1 self-center py-2">
                  <p className="truncate font-semibold">{e.name}</p>
                  {catalogFor(e.code, e.variant)?.subtitle && <p className="truncate text-sm text-ink-soft">{catalogFor(e.code, e.variant)!.subtitle}</p>}
                  <p className="font-num text-sm tabular-nums">{e.sets} × {e.reps}{timed(e) ? " s" : ""} · {loadTxt(e)}</p>
                  <p className="text-sm text-ink-mute">{lastTxt(e)}</p>
                  {e.hint && <p className="text-sm text-brand">{e.hint}</p>}
                </div>
                <div className="flex flex-col justify-center">
                  <button type="button" onClick={() => { tap(6); setInfoId(null); setEditId(e.id); }} aria-label={`Modifier ${e.name}`} className={ui.iconBtn}><Pencil className="size-5" aria-hidden /></button>
                  <button type="button" onClick={() => { tap(8); setList((l) => l.filter((x) => x.id !== e.id)); }} aria-label={`Retirer ${e.name}`} className={cn(ui.iconBtn, "text-ink-soft")}><X className="size-5" aria-hidden /></button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => { tap(6); setAdding(true); }} className={cn(ui.btnSecondary, "mt-3 w-full")}>
            <Plus className="size-5" aria-hidden />Ajouter un exercice
          </button>
        </div>

        <footer className="border-t border-line/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" disabled={list.length === 0} onClick={() => { tap(20); onStart({ ...draft, exercises: list }); }} className={cn(ui.btnPrimary, "h-16 w-full text-lg")}>
            <Play className="size-6" fill="currentColor" aria-hidden />Démarrer
          </button>
        </footer>
      </div>

      <BottomSheet open={edit != null} onClose={() => { setEditId(null); setInfoId(null); }} title={edit?.name}>
        {edit && (
          <div className="mt-4 space-y-3">
            {info ? (
              <ExerciseDetail
                ex={info}
                onBack={() => setInfoId(null)}
                onOpen={setInfoId}
                onAdd={info.code && info.family === edit.code ? (x) => { setVariant(edit, x.code!); setInfoId(null); } : undefined}
                addLabel="Choisir cette variante"
              />
            ) : (
              <>
                {catalogFor(edit.code, edit.variant) && (
                  <button type="button" onClick={() => { tap(6); setInfoId(catalogFor(edit.code, edit.variant)!.id); }} className="inline-flex h-12 items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink-soft active:bg-surface-2">
                    <Info className="size-5" aria-hidden />Fiche de l’exercice
                  </button>
                )}
                {isLafayCode(edit.code) && (prevInLadder(edit.variant) || nextInLadder(edit.variant)) && (
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" disabled={!prevInLadder(edit.variant)} onClick={() => setVariant(edit, prevInLadder(edit.variant)!)} className={cn(ui.btnSecondary, "px-3")}>
                      <Minus className="size-5" aria-hidden />Plus facile{prevInLadder(edit.variant) ? ` (${prevInLadder(edit.variant)})` : ""}
                    </button>
                    <button type="button" disabled={!nextInLadder(edit.variant)} onClick={() => setVariant(edit, nextInLadder(edit.variant)!)} className={cn(ui.btnSecondary, "px-3")}>
                      <Plus className="size-5" aria-hidden />Plus dur{nextInLadder(edit.variant) ? ` (${nextInLadder(edit.variant)})` : ""}
                    </button>
                  </div>
                )}
                {groupsOf(edit.code).map((g) => (
                  <div key={g.name}>
                    {groupsOf(edit.code).length > 1 && <p className="mb-1.5 text-sm font-semibold text-ink-soft">{g.name}</p>}
                    <div role="radiogroup" aria-label={g.name} className="flex flex-wrap gap-2">
                      {g.progression.map((v) => {
                        const on = edit.variant === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => setVariant(edit, v)}
                            className={cn("h-12 min-w-14 touch-manipulation rounded-full px-4 font-num text-metric-sm tabular-nums transition active:scale-95", on ? "bg-ink text-bg" : "bg-surface text-ink-soft")}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <NumberStepper label="Séries" value={edit.sets} min={1} max={30} onChange={(sets) => patch(edit.id, { sets })} />
                <NumberStepper label={timed(edit) ? "Durée par série" : "Répétitions par série"} value={edit.reps} min={1} max={timed(edit) ? 600 : 100} step={timed(edit) ? 5 : 1} unit={timed(edit) ? "s" : undefined} onChange={(reps) => patch(edit.id, { reps, hint: null })} />
                {!isLafayCode(edit.code) && (
                  <NumberStepper
                    label="Charge"
                    value={edit.loadKg ?? 0}
                    step={2.5}
                    max={400}
                    unit="kg"
                    format={(v) => (v === 0 ? "PDC" : fmtNum(v, 2))}
                    onChange={(kg) => patch(edit.id, { loadKg: kg === 0 ? null : kg })}
                  />
                )}
                <button type="button" onClick={() => setEditId(null)} className={cn(ui.btnPrimary, "w-full")}>Terminé</button>
              </>
            )}
          </div>
        )}
      </BottomSheet>

      <AddExerciseSheet
        open={adding}
        onClose={() => setAdding(false)}
        taken={list.map((e) => e.variant ?? e.code)}
        onAdd={(ex) => { setList((l) => [...l, ex]); setAdding(false); }}
      />
    </div>
  );
}
