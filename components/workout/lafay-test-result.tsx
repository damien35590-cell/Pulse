"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { CodeBadge } from "@/components/workout/catalog-bits";
import { catalogExercise } from "@/lib/workout/catalog";
import { applyPlan, deltas, improved, levelFromB, targetText, tome2Start, TEST_ORDER, type TestResult } from "@/lib/workout/lafay-test";

const day = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "=");
const restTxt = (s: number) => (s >= 60 ? `${s / 60} min` : `${s} s`);
const list = (codes: string[]) => (codes.length > 1 ? `${codes.slice(0, -1).join(", ")} et ${codes[codes.length - 1]}` : codes[0]);

/** Les 4 résultats (code, exercice, maximum), avec l'écart au test précédent ; « Bravo » seulement si une valeur le bat. */
export function TestResults({ result, prev }: { result: TestResult; prev: TestResult | null }) {
  const d = deltas(result, prev), up = improved(d);
  return (
    <section aria-label="Résultats" className={cn(ui.card, "p-4")}>
      <h2 className="text-lg font-bold leading-tight text-ink">Résultats</h2>
      <ul className="mt-2 divide-y divide-surface-2">
        {TEST_ORDER.map((c) => {
          const ex = catalogExercise(c);
          return (
            <li key={c} className="flex min-h-14 items-center gap-3 py-2">
              <CodeBadge code={c} className="h-10 min-w-10" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold leading-tight text-ink">{ex?.name ?? c}</p>
                {ex?.subtitle && <p className="truncate text-sm text-ink-soft">{ex.subtitle}</p>}
              </div>
              {d && <span className={cn("w-10 text-right font-num text-sm tabular-nums", d[c] > 0 ? "text-good" : d[c] < 0 ? "text-bad" : "text-ink-mute")}>{signed(d[c])}</span>}
              <span className="w-12 text-right font-num text-metric-md tabular-nums text-ink">{result[c]}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-mute">
        {prev ? "Écart avec le test précédent." : "Premier test : rien à comparer."}
        {up.length > 0 && <> <span className="font-semibold text-good">Bravo</span> : {list(up)} au-dessus du test précédent.</>}
      </p>
    </section>
  );
}

/** Niveau conseillé d'après B (tome 1 p. 39) et, au niveau 2, les reps de départ du tableau du tome 2 (p. 17). */
export function LevelVerdict({ b }: { b: number }) {
  const level = levelFromB(b), t2 = level.id === "lafay-n2" ? tome2Start(b) : null;
  return (
    <section aria-label="Niveau conseillé" className={cn(ui.card, "p-4")}>
      <p className={ui.label}>Niveau conseillé</p>
      <p className="mt-1 text-[22px] font-bold leading-tight text-ink">{level.label}</p>
      <p className="mt-1 text-sm text-ink-soft">B : <span className="font-num tabular-nums text-ink">{b}</span> dips · {level.rule} → {level.label.toLowerCase()} (tome 1 p. 39).</p>
      {level.id === "lafay-n2" && (
        <p className="mt-2 text-sm text-ink-soft">
          {t2
            ? <>Départ du niveau 2 d’après le tableau du tome 2 (p. 17) : <span className="font-num font-semibold tabular-nums text-ink">{t2.sets} × {t2.reps}</span>.</>
            : <>Le tableau du tome 2 commence à 10 dips : pas de valeur pour {b}.</>}
        </p>
      )}
    </section>
  );
}

type Before = { variant: string | null; sets: number; reps: number } | null;

/**
 * « Appliquer à mon programme » : BottomSheet qui résume exactement ce qui change (les dips du modèle « Haut du corps », rien d'autre),
 * puis confirmation. Déjà appliqué : la date et le changement, sans bouton. `onApply` absent (démo) : la feuille ne fait que s'ouvrir.
 */
export function ApplyToProgram({ b, template, before, appliedAt, onApply }: {
  b: number; template: string; before: Before; appliedAt: string | null;
  onApply?: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const plan = applyPlan(b);

  async function confirm() {
    if (!onApply || busy) return;
    tap(20);
    setBusy(true); setErr("");
    const r = await onApply().catch(() => ({ ok: false as const, error: "Impossible d’appliquer ce test : réessaie." }));
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    setOpen(false);
    router.refresh();
  }

  if (appliedAt) {
    return (
      <p className={cn(ui.card, "flex items-center gap-2 p-4 text-sm text-ink-soft")}>
        <Check className="size-4 shrink-0 text-good" aria-hidden />Appliqué à ton programme le {day(appliedAt)}.
      </p>
    );
  }
  return (
    <>
      <button type="button" onClick={() => { tap(10); setErr(""); setOpen(true); }} className={cn(ui.btnPrimary, "w-full")}>Appliquer à mon programme</button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Appliquer à mon programme">
        {plan.kind === "none" ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">{plan.reason} : rien n’est modifié dans ton programme.</p>
            <p className="mt-2 text-sm text-ink-soft">Repère du livre : retest B à 8 reps sur A6 (tome 1 p. 40).</p>
            <button type="button" onClick={() => setOpen(false)} className={cn(ui.btnSecondary, "mt-6 w-full bg-surface-3")}>Fermer</button>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">Une seule ligne change, dans « {template} » :</p>
            <div className={cn(ui.card, "mt-3 bg-surface-2 p-4 shadow-none")}>
              <p className={ui.label}>Dips</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 font-num text-metric-sm tabular-nums">
                <span className="text-ink-mute">{before ? targetText(before) : "aucune"}</span>
                <ArrowRight className="size-4 text-ink-mute" aria-hidden />
                <span className="text-ink">{targetText(plan.after, plan.repsFrom === "max")}</span>
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                Repos {restTxt(plan.after.restSec)} · {plan.repsFrom === "tome2" ? "reps du tableau du tome 2" : plan.repsFrom === "max" ? "maximum de répétitions (modèle niveau 1, programme 2)" : `modèle ${plan.level.label.toLowerCase()}`}
              </p>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-ink-soft">
              <li>La progression des dips repart de cette cible : les séances de dips d’avant le test ne comptent plus pour la suivante.</li>
              <li>Rien d’autre ne change : pompes, tractions et les autres exercices gardent leurs cibles.</li>
            </ul>
            {err && <p role="alert" className="mt-3 text-sm font-medium text-bad">{err}</p>}
            <div className="mt-6 grid gap-2">
              <button type="button" disabled={busy} onClick={confirm} className={cn(ui.btnPrimary, "w-full")}>{busy ? "Application…" : "Appliquer"}</button>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>Annuler</button>
            </div>
          </>
        )}
      </BottomSheet>
    </>
  );
}

/** Historique : une ligne par test (date, A · B · C · A1), « appliqué » le cas échéant ; un toucher ouvre le résultat. */
export function TestHistory({ tests, href = (id) => `/plan/test/${id}` }: { tests: { id: string; takenAt: string; result: TestResult; appliedAt: string | null }[]; href?: (id: string) => string }) {
  if (!tests.length) return <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>Aucun test pour l’instant. Le test (A, B, C, A1) indique ton niveau Lafay de départ.</p>;
  return (
    <ul className={cn(ui.card, "divide-y divide-surface-2 overflow-hidden")}>
      {tests.map((t) => (
        <li key={t.id}>
          <Link href={href(t.id)} className={cn(ui.pressCard, "flex min-h-16 items-center gap-3 px-4 py-2")}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{day(t.takenAt)}{t.appliedAt && <span className={cn(ui.chip, "ml-2 align-middle")}>appliqué</span>}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 font-num text-sm tabular-nums text-ink-soft">
                {TEST_ORDER.map((c) => <span key={c}><span className="text-ink-mute">{c}</span> {t.result[c]}</span>)}
              </p>
            </div>
            <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
