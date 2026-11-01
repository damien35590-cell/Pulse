"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, MoreHorizontal, Minus, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { TopBar } from "@/components/layout/top-bar";
import { BottomSheet, ConfirmSheet } from "@/components/ui/bottom-sheet";
import { NumberStepper } from "@/components/ui/number-stepper";
import { AddExerciseSheet } from "@/components/workout/add-exercise-sheet";
import { CodeBadge } from "@/components/workout/catalog-bits";
import { removeTemplate, saveTemplateEdit } from "@/app/(app)/record/session/actions";
import { exerciseShortName } from "@/lib/art/set-bars";
import { catalogFor, displayName, isLafayCode, nextInLadder, prevInLadder } from "@/lib/workout/catalog";
import type { DraftExercise, TemplateEdit, TemplateEditRow } from "@/lib/workout/types";

const FALLBACK = "/record";
const rest = (s: number) => (s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`);
const timed = (r: TemplateEditRow) => catalogFor(r.code, r.variant)?.mode === "time";
/** Ce qui compte pour « modifié » : tout sauf les clés locales et la cible d'après l'historique. */
const snapshot = (name: string, rows: TemplateEditRow[]) => JSON.stringify([name.trim(), rows.map(({ key, next, ...r }) => r)]);

/** Pastille de code, nom et sous-titre d'une ligne : « A3 · Pompes serrées · support 45 cm » ; SuperPhysique par son nom classique. */
function Heading({ r }: { r: TemplateEditRow }) {
  const lafay = isLafayCode(r.code), cat = catalogFor(r.code, r.variant);
  return (
    <>
      {lafay && <CodeBadge code={r.variant ?? r.code} className="h-10 min-w-10 bg-act-strength-soft text-act-strength" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{cat?.name ?? (lafay ? exerciseShortName(displayName(r.code, r.variant)) : r.code)}</span>
        {cat?.subtitle && <span className="block truncate text-sm text-ink-soft">{cat.subtitle}</span>}
      </span>
    </>
  );
}

/**
 * Éditeur d'un modèle de séance de muscu : nom, exercices (niveau, séries, reps visées ou secondes, repos), ajout, retrait, ordre par flèches.
 * Rien n'est écrit avant « Enregistrer » (retirer un exercice compris). Les reps du modèle ne remplacent jamais la cible de l'historique :
 * seul un changement de niveau repart de ces reps (voir planExercise).
 * `demo` (/ui-kit) : rien n’est envoyé au serveur, ni historique touché ; enregistrer, quitter et supprimer appellent cette fonction.
 */
export function TemplateEditor({ template, demo }: { template: TemplateEdit; demo?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(template.name);
  const [rows, setRows] = useState(template.rows);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [menu, setMenu] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const initial = useRef(snapshot(template.name, template.rows));
  const dirty = snapshot(name, rows) !== initial.current;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const guarded = useRef(false);

  // Retour Android avec des changements : une entrée d'historique « garde » ; le retour la consomme et ouvre la feuille au lieu de quitter.
  useEffect(() => {
    if (demo || !dirty || guarded.current) return;
    guarded.current = true;
    window.history.pushState({ pulseGuard: true }, "");
  }, [dirty]);
  useEffect(() => {
    const onPop = () => {
      if (!dirtyRef.current) {
        // Changements annulés ou déjà enregistrés : la garde est consommée, un second retour quitte vraiment (sauf si exit() s'en charge).
        if (guarded.current) { guarded.current = false; window.history.back(); }
        return;
      }
      window.history.pushState({ pulseGuard: true }, "");
      tap(8);
      setLeaving(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const exit = () => {
    if (demo) return demo();
    if (guarded.current) { guarded.current = false; dirtyRef.current = false; window.history.go(-2); }
    else if (window.history.length > 1) router.back();
    else router.replace(FALLBACK);
  };
  const back = () => { tap(6); if (dirty) setLeaving(true); else exit(); };

  const patch = (key: string, p: Partial<TemplateEditRow>) => setRows((l) => l.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const setVariant = (r: TemplateEditRow, v: string) => { tap(8); patch(r.key, { variant: v }); };
  const move = (i: number, to: number) => {
    tap(8);
    setRows((l) => { const n = [...l]; const [x] = n.splice(i, 1); n.splice(to, 0, x); return n; });
  };
  const add = (e: DraftExercise) => {
    setRows((l) => [...l, { key: e.id, code: e.code, variant: e.variant, baseVariant: e.variant, sets: e.sets, reps: e.reps, restSec: e.restSec, restAfterSec: e.restAfterSec, loadKg: e.loadKg, note: e.note }]);
    setOpenKey(e.id);
    setAdding(false);
  };

  const valid = name.trim().length > 0 && rows.length > 0;
  async function save(): Promise<boolean> {
    if (busy || !valid) return false;
    tap(12);
    setBusy(true);
    setErr("");
    const r = demo ? { ok: true as const } : await saveTemplateEdit(template.id, name, rows).catch(() => ({ ok: false as const, error: "Pas enregistré : vérifie ta connexion." }));
    setBusy(false);
    if (!r.ok) { setErr(r.error); return false; }
    initial.current = snapshot(name, rows);
    dirtyRef.current = false;
    exit();
    return true;
  }
  async function drop() {
    tap(20);
    const ok = demo || await removeTemplate(template.id).catch(() => false);
    if (!ok) { setErr("Impossible de supprimer ce modèle : réessaie."); return; }
    dirtyRef.current = false;
    exit();
  }

  const stepRow = "flex min-h-12 items-center gap-3 rounded-tile px-3 text-base font-semibold select-none touch-manipulation transition duration-150 ease-snappy active:scale-[0.985] active:bg-surface-3";

  return (
    <>
      <TopBar
        title="Modifier le modèle"
        large={false}
        back={back}
        backLabel="Retour"
        actions={
          <>
            <button type="button" disabled={!dirty || !valid || busy} onClick={save} className="h-12 touch-manipulation rounded-full px-4 text-base font-semibold text-brand transition active:bg-surface-2 disabled:text-ink-mute disabled:opacity-60">
              {busy ? "…" : "Enregistrer"}
            </button>
            {!template.isBuiltIn && (
              <button type="button" onClick={() => { tap(); setMenu(true); }} aria-label="Plus d’options" aria-haspopup="dialog" className={ui.iconBtn}>
                <MoreHorizontal className="size-6" aria-hidden />
              </button>
            )}
          </>
        }
      />

      <label className="mt-2 block">
        <span className={ui.label}>Nom du modèle</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          className="mt-1 h-14 w-full rounded-tile bg-surface px-4 text-base font-semibold text-ink caret-brand outline-none ring-1 ring-inset ring-line focus-visible:ring-brand"
        />
      </label>

      <h2 className={cn(ui.label, "mt-6")}>Exercices · {rows.length}</h2>
      {rows.length === 0 && <p className="mt-2 rounded-card bg-surface p-4 text-sm text-ink-soft shadow-card">Aucun exercice : ajoute le premier ci-dessous.</p>}
      <ol className="mt-2 space-y-2">
        {rows.map((r, i) => {
          const open = openKey === r.key, isTimed = timed(r), lafay = isLafayCode(r.code);
          const prev = lafay ? prevInLadder(r.variant) : null, next = lafay ? nextInLadder(r.variant) : null;
          const history = r.next && r.variant === r.baseVariant && (r.next.reps !== r.reps || r.next.variant !== r.variant) ? r.next : null;
          return (
            <li key={r.key} className={cn(ui.card, "p-1")}>
              <div className="flex items-stretch gap-1">
                <div className="flex flex-col justify-center">
                  <button type="button" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Monter ${r.code}`} className={cn(ui.iconBtn, "disabled:opacity-30")}><ChevronUp className="size-6" aria-hidden /></button>
                  <button type="button" disabled={i === rows.length - 1} onClick={() => move(i, i + 1)} aria-label={`Descendre ${r.code}`} className={cn(ui.iconBtn, "disabled:opacity-30")}><ChevronDown className="size-6" aria-hidden /></button>
                </div>
                <button type="button" aria-expanded={open} onClick={() => { tap(6); setOpenKey(open ? null : r.key); }} className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-tile px-1 text-left select-none touch-manipulation active:bg-surface-2">
                  <Heading r={r} />
                  <span className="shrink-0 text-right font-num text-sm tabular-nums text-ink-soft">{r.sets} × {r.reps}{isTimed ? " s" : ""}<span className="block text-ink-mute">{rest(r.restSec)}</span></span>
                </button>
                <div className="flex flex-col justify-center">
                  <button type="button" onClick={() => { tap(8); setRows((l) => l.filter((x) => x.key !== r.key)); }} aria-label={`Retirer ${r.code}`} className={cn(ui.iconBtn, "text-ink-soft")}><X className="size-5" aria-hidden /></button>
                </div>
              </div>
              {open && (
                <div className="space-y-3 px-2 pb-3 pt-2">
                  {lafay && (prev || next) && (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" disabled={!prev} onClick={() => setVariant(r, prev!)} className={cn(ui.btnSecondary, "px-3")}>
                          <Minus className="size-5" aria-hidden />Plus facile{prev ? ` (${prev})` : ""}
                        </button>
                        <button type="button" disabled={!next} onClick={() => setVariant(r, next!)} className={cn(ui.btnSecondary, "px-3")}>
                          <Plus className="size-5" aria-hidden />Plus dur{next ? ` (${next})` : ""}
                        </button>
                      </div>
                      {r.variant !== r.baseVariant && <p className="text-sm text-ink-soft">Nouveau niveau : la prochaine séance repart des répétitions ci-dessous.</p>}
                    </>
                  )}
                  {history && <p className="text-sm text-ink-soft">D’après ton historique, la prochaine séance vise {history.variant ? `${history.variant} · ` : ""}{history.reps}{isTimed ? " s" : " reps"} : elles priment sur celles du modèle.</p>}
                  <NumberStepper label="Séries" value={r.sets} min={1} max={30} onChange={(sets) => patch(r.key, { sets })} />
                  <NumberStepper label={isTimed ? "Durée par série" : "Répétitions par série"} value={r.reps} min={1} max={isTimed ? 600 : 100} step={isTimed ? 5 : 1} unit={isTimed ? "s" : undefined} onChange={(reps) => patch(r.key, { reps })} />
                  <NumberStepper label="Repos entre séries" value={r.restSec} min={0} max={600} step={5} unit="s" onChange={(restSec) => patch(r.key, { restSec })} />
                  <NumberStepper label="Repos avant l’exercice suivant" value={r.restAfterSec} min={0} max={900} step={15} unit="s" onChange={(restAfterSec) => patch(r.key, { restAfterSec })} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <button type="button" onClick={() => { tap(6); setAdding(true); }} className={cn(ui.btnSecondary, "mt-3 w-full")}>
        <Plus className="size-5" aria-hidden />Ajouter un exercice
      </button>
      {err && <p role="alert" className="mt-3 text-sm text-bad">{err}</p>}
      <button type="button" disabled={!dirty || !valid || busy} onClick={save} className={cn(ui.btnPrimary, "mt-6 h-14 w-full")}>
        {busy ? "Enregistrement…" : "Enregistrer"}
      </button>

      <AddExerciseSheet open={adding} onClose={() => setAdding(false)} taken={rows.map((r) => r.variant ?? r.code)} onAdd={add} />

      <BottomSheet open={leaving} onClose={() => setLeaving(false)} title="Modifications non enregistrées">
        <p className="mt-1 text-sm text-ink-soft">Ce modèle a changé depuis son ouverture.</p>
        <div className="mt-6 grid gap-2">
          <button type="button" disabled={!valid || busy} onClick={async () => { if (!(await save())) setLeaving(false); }} className={cn(ui.btnPrimary, "w-full")}>Enregistrer</button>
          <button type="button" onClick={() => { setLeaving(false); exit(); }} className={cn(ui.btnDanger, "w-full")}>Quitter sans enregistrer</button>
          <button type="button" onClick={() => setLeaving(false)} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>Annuler</button>
        </div>
      </BottomSheet>

      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Ce modèle">
        <div className="mt-4 grid gap-1">
          <button type="button" onClick={() => { tap(); setMenu(false); setDropping(true); }} className={cn(stepRow, "h-14 w-full text-bad")}>
            <Trash2 className="size-5" aria-hidden />Supprimer le modèle
          </button>
        </div>
      </BottomSheet>
      <ConfirmSheet
        open={dropping}
        onClose={() => setDropping(false)}
        onConfirm={drop}
        title="Supprimer ce modèle ?"
        message={`« ${template.name} » sera supprimé. Les séances déjà faites ne changent pas.`}
        confirmLabel="Supprimer"
        destructive
      />
    </>
  );
}
