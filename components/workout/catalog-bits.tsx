"use client";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { EQUIPMENT_LABELS, catalogExercise, nextInLadder, prevInLadder } from "@/lib/workout/catalog";
import type { CatalogExercise, Equipment, Muscle } from "@/lib/workout/catalog-data";

export const MUSCLE_LABEL: Record<Muscle, string> = {
  pectoraux: "Pectoraux", epaules: "Épaules", triceps: "Triceps", biceps: "Biceps", dos: "Dos", lombaires: "Lombaires",
  trapezes: "Trapèzes", cou: "Cou", abdominaux: "Abdominaux", obliques: "Obliques", cuisses: "Cuisses", fessiers: "Fessiers",
  ischios: "Ischios", mollets: "Mollets", colonne: "Colonne",
};
const SOURCE: Record<CatalogExercise["source"], string> = { lafay: "Lafay T1", "lafay-turbo": "Lafay T2", superphysique: "SuperPhysique" };

/** Niveau de difficulté du livre : 1 à 4 barres (débutant → haut niveau), discrètes, sans couleur de marque. */
export function LevelBars({ level, className }: { level?: number; className?: string }) {
  if (!level) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Niveau ${level} sur 4`}>
      {[1, 2, 3, 4].map((i) => <span key={i} className={cn("h-1.5 w-3 rounded-full", i <= level ? "bg-ink-soft" : "bg-surface-3")} />)}
    </span>
  );
}

/** Pastille du code Lafay (« A3 ») ; rien pour un exercice sans code. */
export function CodeBadge({ code, className }: { code?: string; className?: string }) {
  if (!code) return null;
  return <span className={cn("grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-surface-2 px-2 font-num text-sm font-semibold tabular-nums", className)}>{code}</span>;
}

const equipTxt = (list: Equipment[]) => list.filter((e) => e !== "aucun").map((e) => EQUIPMENT_LABELS[e as Exclude<Equipment, "aucun">]).join(", ") || "Sans matériel";

/** Fiche d'un exercice : muscles, matériel, niveau, descriptif, page du livre, variantes voisines cliquables. */
export function ExerciseDetail({ ex, onBack, onOpen, onAdd, addLabel = "Ajouter à la séance" }: {
  ex: CatalogExercise;
  onBack?: () => void;
  onOpen: (id: string) => void;
  onAdd?: (ex: CatalogExercise) => void;
  addLabel?: string;
}) {
  const prev = catalogExercise(prevInLadder(ex.code ?? null));
  const next = catalogExercise(nextInLadder(ex.code ?? null));
  const book = ex.bookPage ? `${SOURCE[ex.source]} p. ${ex.bookPage}` : SOURCE[ex.source];
  return (
    <div className="mt-3 space-y-4">
      {onBack && (
        <button type="button" onClick={() => { tap(6); onBack(); }} className="-ml-2 inline-flex h-12 items-center gap-1 rounded-full px-2 text-sm font-semibold text-ink-soft active:bg-surface-2">
          <ArrowLeft className="size-5" aria-hidden />Catalogue
        </button>
      )}
      <div className="flex items-center gap-3">
        <CodeBadge code={ex.code} className="h-12 min-w-12 text-metric-sm" />
        <div className="min-w-0">
          <p className="text-lg font-semibold leading-tight">{ex.name}</p>
          {ex.subtitle && <p className="text-sm text-ink-soft">{ex.subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ex.muscles.map((m) => <span key={m} className={ui.chip}>{MUSCLE_LABEL[m]}</span>)}
        {ex.mode === "time" && <span className={ui.chip}>Au chrono</span>}
        {ex.unilateral && <span className={ui.chip}>Un côté puis l’autre</span>}
      </div>
      <p className="text-base leading-relaxed text-ink">{ex.description}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className={ui.label}>Matériel</dt><dd className="text-ink-soft">{equipTxt(ex.equipment)}</dd>
        {ex.level && <><dt className={ui.label}>Niveau</dt><dd className="flex items-center gap-2 text-ink-soft"><LevelBars level={ex.level} />{["débutant", "entraîné", "confirmé", "haut niveau"][ex.level - 1]}</dd></>}
        <dt className={ui.label}>Source</dt><dd className="text-ink-soft">{book}</dd>
      </dl>
      {(prev || next) && (
        <div className="grid grid-cols-2 gap-2">
          {[prev, next].map((v, i) => v ? (
            <button key={v.id} type="button" onClick={() => { tap(6); onOpen(v.id); }} className={cn(ui.card, ui.pressCard, "flex min-h-14 items-center gap-2 p-3 text-left", i === 1 && "col-start-2")}>
              <span className="min-w-0 flex-1">
                <span className="block text-label uppercase text-ink-mute">{i === 0 ? "Plus facile" : "Plus dur"}</span>
                <span className="block truncate text-sm font-semibold">{v.code} · {v.subtitle ?? v.name}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
            </button>
          ) : null)}
        </div>
      )}
      {onAdd && <button type="button" onClick={() => onAdd(ex)} className={cn(ui.btnPrimary, "w-full")}>{addLabel}</button>}
    </div>
  );
}
