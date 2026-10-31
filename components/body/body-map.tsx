"use client";
import { useEffect, useMemo, useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { levelStep, muscleList, preferredView, recoveryStep, type MuscleId, type MuscleLevels, type MuscleStep } from "@/lib/workout/body";
import { BACK_SHAPES, BODY_OUTLINE, FRONT_SHAPES, FULL_FRAME, STEP_BG, STEP_FILL, thumbFrame, type BodyShape } from "./body-shapes";

type View = "front" | "back";
type Steps = Partial<Record<MuscleId, MuscleStep>>;
export type BodyMapProps = {
  /** Muscles principaux (palier 4) et secondaires (palier 1, nettement plus faible) : la fiche d'un exercice. */
  primary?: readonly MuscleId[];
  secondary?: readonly MuscleId[];
  /** Carte d'une séance (sessionLevels : principal 1, secondaire 0,5, additionnés) : palier par levelStep. */
  intensity?: MuscleLevels;
  /** Paliers 1 à 4 déjà calculés (volume de la page Analyse, normalisé sur le maximum de la période). */
  steps?: Steps;
  /** Récupération 0 (fatigué) à 1 (récupéré) : fatigué = palier 4 → presque récupéré = 1 ; un muscle absent est récupéré. */
  recovery?: MuscleLevels;
  /** auto : le côté du muscle moteur (premier de `primary`), sinon celui qui montre le plus de muscles sollicités. */
  view?: View | "auto";
  /** thumb : vignette ronde (avatar d'exercice) ; md : fiche ; full : grande carte. */
  size?: "thumb" | "md" | "full";
  /** Bouton pour retourner le corps (md et full). */
  flip?: boolean;
  /** Libellé « Face » / « Dos » en haut à gauche (md et full). */
  caption?: boolean;
  /** Nom accessible ; par défaut, la liste des muscles sollicités. */
  label?: string;
  className?: string;
};

// Corps au repos : gris neutre, nettement distinct du palier 1 (indigo). En sombre, silhouette surface-2 et muscles surface-3 ;
// en clair, silhouette surface-3 et muscles une nuance d'encre au-dessus (surface-2 ne se détache pas d'un fond blanc).
const SKIN = "fill-surface-3 dark:fill-surface-2";
const REST = "fill-ink/10 dark:fill-surface-3";
const REST_BG = "bg-ink/10 dark:bg-surface-3";

const Swatches = ({ steps }: { steps: (MuscleStep | 0)[] }) => (
  <span aria-hidden className="flex gap-0.5">
    {steps.map((s, i) => <i key={i} className={cn("h-2.5 w-4 first:rounded-l-full last:rounded-r-full", s ? STEP_BG[s] : REST_BG)} />)}
  </span>
);

/**
 * Légende sous une carte : `level` (principal / secondaire), `recovery` (fatigué → récupéré),
 * `volume` (4 paliers entre les valeurs réelles `min` et `max`, ex. « 2 → 5 séries/sem. »).
 */
export function MuscleLegend({ kind = "level", min, max, className }: { kind?: "level" | "recovery" | "volume"; min?: string; max?: string; className?: string }) {
  const row = cn("flex items-center gap-2 text-xs text-ink-mute", className);
  if (kind === "volume") return <div className={row}><span className="font-num tabular-nums">{min}</span><Swatches steps={[1, 2, 3, 4]} /><span className="font-num tabular-nums">{max}</span></div>;
  if (kind === "recovery") return <div className={row}><span>Fatigué</span><Swatches steps={[4, 3, 2, 1, 0]} /><span>Récupéré</span></div>;
  return (
    <div className={cn(row, "gap-4")}>
      <span className="inline-flex items-center gap-1.5"><i aria-hidden className={cn("size-2.5 rounded-full", STEP_BG[4])} />Principal</span>
      <span className="inline-flex items-center gap-1.5"><i aria-hidden className={cn("size-2.5 rounded-full", STEP_BG[1])} />Secondaire</span>
    </div>
  );
}

/** Une moitié du corps (la droite est la même en miroir) : silhouette, puis chaque muscle, séparés par un trait de la couleur de la silhouette. */
function Half({ shapes, steps, stroke }: { shapes: BodyShape[]; steps: Steps; stroke: number }) {
  return (
    <>
      <path d={BODY_OUTLINE} className={SKIN} />
      {shapes.map((s, i) => {
        const st = s.m ? steps[s.m] : undefined;
        return <path key={i} d={s.d} className={cn("stroke-surface-3 transition-[fill] duration-300 dark:stroke-surface-2", st ? STEP_FILL[st] : REST)} strokeWidth={stroke} strokeLinejoin="round" />;
      })}
    </>
  );
}

function Figure({ view, steps, stroke }: { view: View; steps: Steps; stroke: number }) {
  const shapes = view === "front" ? FRONT_SHAPES : BACK_SHAPES;
  return (
    <>
      <g><Half shapes={shapes} steps={steps} stroke={stroke} /></g>
      <g transform="translate(200 0) scale(-1 1)"><Half shapes={shapes} steps={steps} stroke={stroke} /></g>
    </>
  );
}

/** « Face. Pectoraux et triceps ; en soutien : avant des épaules. » */
function describe(view: View, steps: Steps, recovery: boolean): string {
  const side = view === "front" ? "Face" : "Dos";
  const list = (Object.entries(steps) as [MuscleId, MuscleStep][]).sort((a, b) => b[1] - a[1]);
  const strong = list.filter(([, s]) => s >= 3).map(([id]) => id), weak = list.filter(([, s]) => s < 3).map(([id]) => id);
  if (recovery) return `${side}. ${strong.length ? `Encore fatigués : ${muscleList(strong).toLowerCase()}.` : list.length ? "Presque tout est récupéré." : "Tous les muscles sont récupérés."}`;
  if (!list.length) return `${side}. Aucun muscle sollicité.`;
  return `${side}. ${strong.length ? muscleList(strong) : ""}${strong.length && weak.length ? " ; en soutien : " : ""}${weak.length ? muscleList(weak).toLowerCase() : ""}.`;
}

/**
 * Carte des muscles : corps de face et de dos (illustration originale, components/body/body-shapes.ts). Muscles au repos en gris neutre,
 * sollicités en 4 paliers de la teinte de la muscu (tokens muscle-1 à muscle-4, aucune autre couleur).
 * - thumb : vignette ronde (48 px, size-14 par className), cadrée sur les muscles sollicités ; décorative (aria-hidden).
 * - md (176 px de haut) et full (288 px) : libellé Face / Dos et bouton de retournement (48 px, tap()).
 */
export function BodyMap({ primary, secondary, intensity, steps: given, recovery, view = "auto", size = "md", flip = size !== "thumb", caption = true, label, className }: BodyMapProps) {
  const steps = useMemo<Steps>(() => {
    if (given) return given;
    const out: Steps = {};
    const put = (id: MuscleId, s: MuscleStep | null) => { if (s) out[id] = s; };
    if (recovery) (Object.entries(recovery) as [MuscleId, number][]).forEach(([id, r]) => put(id, recoveryStep(r)));
    else if (intensity) (Object.entries(intensity) as [MuscleId, number][]).forEach(([id, v]) => put(id, levelStep(v)));
    else {
      secondary?.forEach((id) => put(id, 1));
      primary?.forEach((id) => put(id, 4));
    }
    return out;
  }, [given, recovery, intensity, primary, secondary]);
  // Poids 0 à 1 de chaque muscle : choix de la vue et cadrage de la vignette.
  const weights = useMemo<MuscleLevels>(() => Object.fromEntries((Object.entries(steps) as [MuscleId, MuscleStep][]).map(([id, s]) => [id, s / 4])), [steps]);
  const auto = view === "auto" ? preferredView(weights, given || intensity || recovery ? undefined : primary?.[0]) : view;
  const key = JSON.stringify(steps);
  // Nombre de retournements : pair = la vue choisie. Remis à zéro pour un autre exercice ; anime le corps seulement après un toucher.
  const [turns, setTurns] = useState(0);
  useEffect(() => setTurns(0), [auto, key]);
  const side: View = turns % 2 ? (auto === "front" ? "back" : "front") : auto;

  if (size === "thumb") {
    const [x, y, w, h] = thumbFrame(weights);
    return (
      <span aria-hidden className={cn("block size-12 shrink-0 overflow-hidden rounded-full bg-bg", className)}>
        <svg viewBox={`${x} ${y} ${w} ${h}`} className="block size-full"><Figure view={side} steps={steps} stroke={1.6} /></svg>
      </span>
    );
  }

  const [x, y, w, h] = FULL_FRAME;
  return (
    <figure className={cn("relative", size === "md" ? "h-44" : "h-72", className)}>
      <svg key={turns} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={label ?? describe(side, steps, !!recovery)} className={cn("mx-auto block h-full w-auto origin-center", turns > 0 && "animate-body-turn")}>
        <Figure view={side} steps={steps} stroke={1.1} />
      </svg>
      {caption && <figcaption aria-hidden className={cn(ui.label, "absolute left-0 top-0")}>{side === "front" ? "Face" : "Dos"}</figcaption>}
      {flip && (
        <button
          type="button"
          onClick={() => { tap(6); setTurns((t) => t + 1); }}
          aria-label={side === "front" ? "Voir le dos" : "Voir la face"}
          className={cn(ui.iconBtn, "absolute -bottom-1 -right-1 text-ink-soft")}
        >
          <RotateCw className="size-5" aria-hidden />
        </button>
      )}
    </figure>
  );
}

/** Face et dos côte à côte, sans retournement (fiche de séance, Analyse) : mêmes entrées que BodyMap. */
export function BodyPair({ className, ...p }: Omit<BodyMapProps, "view" | "flip" | "size">) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <BodyMap {...p} size="md" view="front" flip={false} />
      <BodyMap {...p} size="md" view="back" flip={false} />
    </div>
  );
}
