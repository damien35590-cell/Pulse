import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { fmtKm, fmtNum, fmtPaceS } from "@/lib/format";
import { Delta, Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { PACE_TOLERANCE_S, type RepReview, type RepStatus, type RepsReview } from "@/lib/training/reps";

const COLS = "grid-cols-[1.75rem_minmax(0,1fr)_3.25rem_3.5rem]";
/** Dans la cible = bien ; trop rapide = à surveiller (la suite paie) ; trop lente = en dessous de la séance. */
const TONE: Record<RepStatus, "good" | "warn" | "bad"> = { ok: "good", fast: "warn", slow: "bad" };
const STATUS: Record<RepStatus, string> = { ok: "dans la cible", fast: "trop rapide", slow: "trop lente" };

const dist = (m: number) => (m < 1000 ? `${m} m` : `${fmtKm(m)} km`);
const signed = (s: number) => (s > 0 ? `+${s}` : s < 0 ? `−${-s}` : "0");

/** Cible commune à toutes les répétitions notées, sinon null (séance pyramidale, cibles mêlées). */
function commonTarget(reps: RepReview[]) {
  const t = reps.flatMap((r) => (r.target ? [r.target] : []));
  return t.length && t.every((x) => x.mid === t[0].mid) ? t[0] : null;
}

/**
 * Fractionné de la fiche d'activité : 3 chiffres (dans la cible, trop lentes, trop rapides), puis une ligne par répétition
 * (distance · temps, allure, écart à l'allure du programme en s/km). Sans cible (séance non reliée, sans allure) : nombre de
 * répétitions, allure et FC moyennes. Données : getActivityReps (lib/data/reps.ts).
 */
export function WorkReps({ review, sessionTitle, className }: { review: RepsReview; sessionTitle?: string | null; className?: string }) {
  const { reps, counts, vmaKmh } = review;
  const rated = counts.rated > 0, common = commonTarget(reps);
  const totD = reps.reduce((s, r) => s + r.d, 0), totT = reps.reduce((s, r) => s + r.t, 0);
  const hrs = reps.flatMap((r) => (r.hr ? [r.hr] : [])), hasHr = hrs.length > 0;

  return (
    <Section title="Fractionné" className={className} action={common && <span className="font-num text-sm tabular-nums text-ink-mute">Cible {fmtPaceS(common.mid)} /km</span>}>
      <div className={cn(ui.card, "p-4")}>
        <dl className="grid grid-cols-3 gap-3">
          {rated ? (
            <>
              <Metric size="md" label="Dans la cible" value={`${counts.ok}/${counts.rated}`} tone={counts.ok === counts.rated ? "good" : "default"} />
              <Metric size="md" label="Trop lentes" value={counts.slow} tone={counts.slow ? "bad" : "soft"} />
              <Metric size="md" label="Trop rapides" value={counts.fast} tone="soft" />
            </>
          ) : (
            <>
              <Metric size="md" label="Répétitions" value={reps.length} />
              <Metric size="md" label="Allure moy." value={fmtPaceS(totT / (totD / 1000))} unit="/km" />
              {hasHr && <Metric size="md" label="FC moy." value={Math.round(hrs.reduce((s, x) => s + x, 0) / hrs.length)} unit="bpm" />}
            </>
          )}
        </dl>

        <div className={cn("mt-4 grid gap-3 px-1 pb-2 text-label uppercase text-ink-mute", COLS)}>
          <span>N°</span>
          <span>Distance · temps</span>
          <span className="text-right">Allure</span>
          <span className="text-right">{rated ? "Écart" : hasHr ? "FC" : ""}</span>
        </div>
        <ol className="divide-y divide-line/60">
          {reps.map((r) => (
            <li key={r.n} className={cn("grid h-11 items-center gap-3 px-1", COLS)} aria-label={r.status ? `Répétition ${r.n}, ${STATUS[r.status]}` : undefined}>
              <span className="font-num text-sm tabular-nums text-ink-mute">{r.n}</span>
              <span className="truncate font-num text-sm tabular-nums text-ink-soft">
                {dist(r.d)} · {fmtPaceS(r.t)}{hasHr && rated && r.hr ? <span className="text-ink-mute"> · {r.hr} bpm</span> : null}
              </span>
              <span className="text-right font-num text-metric-sm tabular-nums text-ink">{fmtPaceS(r.paceS)}</span>
              <span className="text-right">
                {r.status && r.deltaS != null
                  ? <Delta tone={TONE[r.status]}>{signed(r.deltaS)} s</Delta>
                  : <span className="font-num text-sm tabular-nums text-ink-mute">{!rated && r.hr ? r.hr : ""}</span>}
              </span>
            </li>
          ))}
        </ol>

        <p className="mt-3 px-1 text-xs text-ink-mute">
          {rated
            ? <>Écart à l’allure du programme{sessionTitle ? ` (${sessionTitle})` : ""}{vmaKmh ? `, VMA ${fmtNum(vmaKmh)} km/h` : ""} ; ±{PACE_TOLERANCE_S} s/km tolérées autour de la fourchette. Découpage Intervals.icu.</>
            : <>Pas d’allure cible à comparer : sortie non reliée à une séance du programme, ou séance sans allure. Découpage Intervals.icu.</>}
        </p>
      </div>
    </Section>
  );
}
