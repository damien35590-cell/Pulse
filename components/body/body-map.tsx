"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { muscleList, preferredView, recoveryStep, sessionLevels, type MuscleId, type MuscleLevels, type RecoveryStep } from "@/lib/workout/body";
import { BACK_SHAPES, BODY_OUTLINE, FRONT_SHAPES, FULL_FRAME, muscleFill, thumbFrame, type BodyShape } from "./body-shapes";

type View = "front" | "back";
export type BodyMapProps = {
  /** Muscles principaux (pleine couleur) et secondaires : la fiche d'un exercice. */
  primary?: readonly MuscleId[];
  secondary?: readonly MuscleId[];
  /** Niveau 0 à 1 par muscle (prioritaire sur primary / secondary) : 1 = principal, 0,5 = secondaire, valeurs intermédiaires en dégradé. */
  intensity?: MuscleLevels;
  /** Récupération 0 (fatigué) à 1 (récupéré) par muscle, en 4 paliers muscle-tired → muscle-fresh ; un muscle absent est récupéré. */
  recovery?: MuscleLevels;
  /** auto : le côté du muscle moteur (premier de `primary`), sinon celui qui montre le plus de muscles sollicités. */
  view?: View | "auto";
  /** thumb : vignette ronde (avatar d'exercice) ; md : fiche ; full : séance. */
  size?: "thumb" | "md" | "full";
  /** Bouton pour retourner le corps (md et full). */
  flip?: boolean;
  /** Libellé « Face » / « Dos » en haut à gauche (md et full). */
  caption?: boolean;
  /** Nom accessible ; par défaut, la liste des muscles sollicités. */
  label?: string;
  className?: string;
};

const STEP_FILL: Record<RecoveryStep, string> = {
  fresh: "fill-muscle-fresh", recovering: "fill-muscle-recovering", worked: "fill-muscle-worked", tired: "fill-muscle-tired",
};

/** Légende sous une carte : principal / secondaire, paliers de récupération, ou dégradé de volume (`max` : libellé de la pleine couleur). */
export function MuscleLegend({ kind = "level", max, className }: { kind?: "level" | "recovery" | "volume"; max?: string; className?: string }) {
  const dot = "size-2.5 shrink-0 rounded-full";
  if (kind === "volume") {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-ink-mute", className)}>
        <span>Peu</span>
        <span aria-hidden className="flex gap-0.5">
          {[0.2, 0.4, 0.6, 0.8, 1].map((v) => <i key={v} className="h-2.5 w-4 first:rounded-l-full last:rounded-r-full" style={{ background: muscleFill(v) }} />)}
        </span>
        <span>{max ?? "Beaucoup"}</span>
      </div>
    );
  }
  if (kind === "recovery") {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-ink-mute", className)}>
        <span>Fatigué</span>
        <span aria-hidden className="flex gap-0.5">
          {["bg-muscle-tired", "bg-muscle-worked", "bg-muscle-recovering", "bg-muscle-fresh", "bg-ink/10 dark:bg-surface-3"].map((c) => <i key={c} className={cn("h-2.5 w-4 first:rounded-l-full last:rounded-r-full", c)} />)}
        </span>
        <span>Récupéré</span>
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-4 text-xs text-ink-mute", className)}>
      <span className="inline-flex items-center gap-1.5"><i aria-hidden className={cn(dot, "bg-muscle-primary")} />Principal</span>
      <span className="inline-flex items-center gap-1.5"><i aria-hidden className={cn(dot, "bg-muscle-secondary")} />Secondaire</span>
    </div>
  );
}

// Corps au repos : en sombre, silhouette surface-2 et muscles surface-3 ; en clair, silhouette surface-3 et muscles une nuance d'encre
// au-dessus (surface-2 ne se détache pas d'un fond blanc).
const SKIN = "fill-surface-3 dark:fill-surface-2";
const REST = "fill-ink/10 dark:fill-surface-3";

/** Une moitié du corps (la droite est la même en miroir) : silhouette, puis chaque muscle, séparés par un trait de la couleur de la silhouette. */
function Half({ shapes, paint, stroke }: { shapes: BodyShape[]; paint: (m: MuscleId | null) => { className: string; style?: CSSProperties }; stroke: number }) {
  return (
    <>
      <path d={BODY_OUTLINE} className={SKIN} />
      {shapes.map((s, i) => {
        const p = paint(s.m);
        return <path key={i} d={s.d} className={cn("stroke-surface-3 transition-[fill] duration-300 dark:stroke-surface-2", p.className)} style={p.style} strokeWidth={stroke} strokeLinejoin="round" />;
      })}
    </>
  );
}

function Figure({ view, paint, stroke }: { view: View; paint: (m: MuscleId | null) => { className: string; style?: CSSProperties }; stroke: number }) {
  const shapes = view === "front" ? FRONT_SHAPES : BACK_SHAPES;
  return (
    <>
      <g><Half shapes={shapes} paint={paint} stroke={stroke} /></g>
      <g transform="translate(200 0) scale(-1 1)"><Half shapes={shapes} paint={paint} stroke={stroke} /></g>
    </>
  );
}

/** « Face : pectoraux et triceps ; en soutien : avant des épaules. » */
function describe(view: View, levels: MuscleLevels, recovery: boolean): string {
  const side = view === "front" ? "Face" : "Dos";
  const list = (Object.entries(levels) as [MuscleId, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (recovery) {
    const tired = list.filter(([, f]) => f > 0.5).map(([id]) => id);
    return `${side}. ${tired.length ? `Encore fatigués : ${muscleList(tired).toLowerCase()}.` : list.length ? "Presque tout est récupéré." : "Tous les muscles sont récupérés."}`;
  }
  const main = list.filter(([, v]) => v > 0.5).map(([id]) => id), help = list.filter(([, v]) => v <= 0.5).map(([id]) => id);
  if (!main.length && !help.length) return `${side}. Aucun muscle sollicité.`;
  return `${side}. ${main.length ? muscleList(main) : ""}${main.length && help.length ? " ; en soutien : " : ""}${help.length ? muscleList(help).toLowerCase() : ""}.`;
}

/**
 * Carte des muscles : corps de face et de dos (illustration originale, components/body/body-shapes.ts), muscles au repos dans les tons
 * de surface (SKIN, REST), sollicités en muscle-primary / muscle-secondary ou en paliers de récupération. Couleurs : tokens du thème uniquement.
 * - thumb : vignette ronde (48 px, size-14 par className), cadrée sur les muscles sollicités ; décorative (aria-hidden).
 * - md (176 px de haut) et full (288 px) : libellé Face / Dos et bouton de retournement (48 px, tap()).
 */
export function BodyMap({ primary, secondary, intensity, recovery, view = "auto", size = "md", flip = size !== "thumb", caption = true, label, className }: BodyMapProps) {
  // Niveau par muscle (pour une carte de récupération : la fatigue, 1 − récupération), qui décide aussi de la vue et du cadrage.
  const levels = useMemo<MuscleLevels>(() => {
    if (intensity) return intensity;
    if (recovery) return Object.fromEntries((Object.entries(recovery) as [MuscleId, number][]).filter(([, r]) => r < 1).map(([id, r]) => [id, 1 - r]));
    return sessionLevels([{ primary: [...(primary ?? [])], secondary: [...(secondary ?? [])] }]);
  }, [intensity, recovery, primary, secondary]);
  const auto = view === "auto" ? preferredView(levels, intensity || recovery ? undefined : primary?.[0]) : view;
  const key = JSON.stringify(levels);
  // Nombre de retournements : pair = la vue choisie. Remis à zéro pour un autre exercice ; anime le corps seulement après un toucher.
  const [turns, setTurns] = useState(0);
  useEffect(() => setTurns(0), [auto, key]);
  const side: View = turns % 2 ? (auto === "front" ? "back" : "front") : auto;

  const paint = (m: MuscleId | null): { className: string; style?: CSSProperties } => {
    if (!m) return { className: REST };
    if (recovery) {
      const step = recoveryStep(recovery[m]);
      return { className: step ? STEP_FILL[step] : REST };
    }
    const fill = muscleFill(levels[m] ?? 0);
    return fill ? { className: "", style: { fill } } : { className: REST };
  };

  if (size === "thumb") {
    const [x, y, w, h] = thumbFrame(levels);
    return (
      <span aria-hidden className={cn("block size-12 shrink-0 overflow-hidden rounded-full bg-bg", className)}>
        <svg viewBox={`${x} ${y} ${w} ${h}`} className="block size-full"><Figure view={side} paint={paint} stroke={1.6} /></svg>
      </span>
    );
  }

  const [x, y, w, h] = FULL_FRAME;
  const name = label ?? describe(side, levels, !!recovery);
  return (
    <figure className={cn("relative", size === "md" ? "h-44" : "h-72", className)}>
      <svg key={turns} viewBox={`${x} ${y} ${w} ${h}`} role="img" aria-label={name} className={cn("mx-auto block h-full w-auto origin-center", turns > 0 && "animate-body-turn")}>
        <Figure view={side} paint={paint} stroke={1.1} />
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
