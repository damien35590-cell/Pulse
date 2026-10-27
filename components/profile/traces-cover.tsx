import { fmtNum } from "@/lib/format";
import { TRACES_H, TRACES_W, type TracesArt } from "@/lib/art/traces";
import { Metric } from "@/components/ui/metric";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

export type Totals = { km: number; count: number; elevation: number; hours: number };

// Chiffre au-dessus, libellé dessous (Metric met le libellé en tête : on inverse l'ordre).
const stat = "flex flex-col-reverse items-center text-center [&>dt]:mt-1";

/**
 * Couverture de la page Vous : toutes les traces GPS en plein air superposées sur une même origine, fines et discrètes,
 * une seule en vedette avec son point d'arrivée. Art sur `art-run-bg` (règle 8 : toujours sombre, jamais derrière un chiffre) ;
 * les totaux sont sous l'art, sur la carte. Les chemins sont calculés côté serveur (`getTracesArt`) : rien à dessiner de lourd ici.
 */
export function TracesCover({ art, totals }: { art: TracesArt; totals: Totals }) {
  return (
    <section aria-label="Toutes tes traces" className={cn(ui.card, "overflow-hidden")}>
      <div className="relative h-[180px] overflow-hidden bg-art-run-bg">
        {art.count > 0 ? (
          <svg role="img" aria-label={`${art.count} trace${art.count > 1 ? "s" : ""} de tes sorties en plein air, superposées`} viewBox={`0 0 ${TRACES_W} ${TRACES_H}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 size-full">
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-art-run-fg">
              <g strokeWidth={1} opacity={0.09}>
                {art.paths.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
              </g>
              {art.hero && <path d={art.hero.d} strokeWidth={2} vectorEffect="non-scaling-stroke" />}
            </g>
            {art.hero && <circle cx={art.hero.end[0]} cy={art.hero.end[1]} r={4} className="fill-art-run-fg stroke-art-run-bg" strokeWidth={2} />}
          </svg>
        ) : (
          <p className="absolute inset-x-4 top-1/2 -translate-y-1/2 text-center text-sm text-art-ink-soft-run">Tes traces apparaîtront dès ta première sortie en plein air.</p>
        )}
        <p className="absolute left-4 top-3 text-label uppercase text-art-ink-soft-run">Toutes tes traces</p>
      </div>
      <dl className="grid grid-cols-4 gap-2 p-4">
        <Metric className={stat} align="center" label="km" value={fmtNum(totals.km, 0)} />
        <Metric className={stat} align="center" label="sorties" value={totals.count} />
        <Metric className={stat} align="center" label="m D+" value={fmtNum(totals.elevation, 0)} />
        <Metric className={stat} align="center" label="h" value={fmtNum(totals.hours, 0)} />
      </dl>
    </section>
  );
}
