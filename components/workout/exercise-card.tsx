import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { Delta, Metric } from "@/components/ui/metric";
import { ExerciseBars } from "@/components/art/set-bars";
import { CodeBadge } from "@/components/workout/catalog-bits";
import { CardioToggle } from "@/components/workout/cardio-toggle";
import type { ExerciseReview } from "@/lib/workout/session-review";

const CHIP_TONE = { good: "bg-good/15 text-good", warn: "bg-warn/15 text-warn", neutral: "" } as const;
/** « +6 », « −2 s », « ±0 » : écart de total avec la dernière fois. */
const signed = (n: number, timed: boolean) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}${timed ? " s" : ""}`;

/**
 * Carte d'un exercice de muscu (fiche d'activité, démo /ui-kit) : code, nom, variante, cible ; séries réelles face à la cible ; total et écart avec la dernière fois ; état Lafay.
 * La FC par série (pic, récup) est secondaire : repliée derrière « ♥ Cardio », seulement si l'exercice en a.
 */
export function ExerciseCard({ r, defaultCardioOpen }: { r: ExerciseReview; defaultCardioOpen?: boolean }) {
  const hasHr = r.sets.some((s) => s.hrPeak != null || s.hrEndRest != null);
  const status = (r.status || r.next) && (
    <>
      {r.status && <span className={cn(ui.chip, CHIP_TONE[r.status.tone])}>{r.status.label}</span>}
      {r.next && <p className="text-sm text-ink-soft">{r.next}</p>}
    </>
  );
  return (
    <li className={cn(ui.card, "p-4")}>
      <div className="flex items-start gap-3">
        {r.code && <CodeBadge code={r.code} className="h-10 min-w-10 bg-act-strength-soft text-act-strength" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-ink">{r.title}</p>
          {r.subtitle && <p className="mt-0.5 text-sm leading-snug text-ink-soft">{r.subtitle}</p>}
          <p className="mt-1 font-num text-sm tabular-nums text-ink-mute">{r.targetText}</p>
        </div>
        <dl className="shrink-0">
          <Metric
            size="md" align="end" label="Total" value={r.total} unit={r.timed ? "s" : "reps"}
            hint={r.delta != null && <Delta tone={r.delta > 0 ? "good" : r.delta < 0 ? "bad" : "neutral"}>{signed(r.delta, r.timed)}</Delta>}
          />
        </dl>
      </div>
      {r.sets.length > 0 && <ExerciseBars className="mt-3" sets={r.sets} target={r.target} timed={r.timed} />}
      {r.loads && <p className="mt-1 font-num text-sm tabular-nums text-ink-soft">Charges : {r.loads}</p>}
      {hasHr
        ? <CardioToggle sets={r.sets} defaultOpen={defaultCardioOpen}>{status}</CardioToggle>
        : status && <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">{status}</div>}
      {r.comment && <p className="mt-2 text-sm text-ink-soft">{r.comment}</p>}
    </li>
  );
}
