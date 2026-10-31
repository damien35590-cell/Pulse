import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { recoveryLine, type MuscleLevels } from "@/lib/workout/body";
import { BodyMap, MuscleLegend } from "./body-map";

/**
 * Récupération des muscles (carte du jour de l'accueil, quand le coach propose la muscu) : face et dos en petit,
 * paliers muscle-4 (fatigué) → muscle-1 (presque récupéré), une phrase sur les muscles encore à ménager. Données : recoveryLevels (lib/workout/body.ts).
 */
export function MuscleRecovery({ levels, className }: { levels: MuscleLevels; className?: string }) {
  return (
    <section aria-label="Récupération des muscles" className={cn("flex items-center gap-3", className)}>
      <div className="flex shrink-0">
        <BodyMap size="md" view="front" flip={false} caption={false} recovery={levels} className="h-28 w-12" />
        <BodyMap size="md" view="back" flip={false} caption={false} recovery={levels} className="h-28 w-12" />
      </div>
      <div className="min-w-0">
        <p className={ui.label}>Récupération</p>
        <p className="mt-1 text-sm leading-snug text-ink-soft">{recoveryLine(levels)}</p>
        <MuscleLegend kind="recovery" className="mt-2" />
      </div>
    </section>
  );
}
