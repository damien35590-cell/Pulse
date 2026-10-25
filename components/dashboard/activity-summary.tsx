import Link from "next/link";
import { Flag } from "lucide-react";
import { activityStyle } from "@/lib/activity-style";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { Metric } from "@/components/ui/metric";
import { ZoneBar, type ZoneSlice } from "@/components/activity/zone-bar";
import { RoutePreview } from "@/components/activity/route-preview";
import { InsightLine } from "@/components/activity/insight-line";
import { ZoneRibbon } from "@/components/art/zone-ribbon";
import { EffortStrip } from "@/components/art/effort-strip";
import { SetBars } from "@/components/art/set-bars";
import type { RibbonSegment } from "@/lib/art/zone-ribbon";
import type { SetGroup } from "@/lib/art/set-bars";
import type { InsightLine as Line } from "@/lib/activity/comparables";
import type { LatLng } from "@/lib/polyline";

export type ActivitySummaryData = {
  id: string;
  type: string;
  title: string;
  when: string;
  /** Les 3 chiffres qui comptent pour CE sport (course : distance, temps, allure ; muscu : durée, séries, volume). */
  metrics: { label: string; value: string; unit?: string }[];
  zones?: ZoneSlice[];
  tags?: string[];
  /** La phrase unique : même comparaison que la fiche (lib/activity/comparables.ts : insightLine). */
  insight?: Line;
  badge?: string;
  /** Compétition : pastille « Compétition » sous la date. */
  isRace?: boolean;
  /** Trace GPS simplifiée (~200 points, previewTrack) : absente en intérieur ou en muscu, et alors pas de carte. */
  route?: LatLng[];
  /** Art dérivé des données (lib/art/card.ts), au plus un des trois : ruban sous la carte, profil d'effort à sa place, ou séries de muscu en tête. */
  ribbon?: RibbonSegment[];
  effort?: { segments: RibbonSegment[]; label?: string };
  sets?: SetGroup[];
};

/**
 * Carte de résumé (fil d'activités, accueil) : on y lit « comment ça s'est passé » en 2 secondes.
 * Hiérarchie : titre → 3 chiffres → bande de zones → une seule phrase d'analyse → vignette du tracé. Tout le reste est dans le détail.
 */
export function ActivitySummary({ a, href, onSelect }: { a: ActivitySummaryData; href?: string; onSelect?: () => void }) {
  const { icon: Icon, fg, soft } = activityStyle(a.type);
  const hasMap = !!a.route && a.route.length > 1;
  const body = (
    <>
      {a.sets && <SetBars groups={a.sets} className="-mx-4 -mt-4 mb-4 w-[calc(100%_+_2rem)] rounded-t-card" />}
      <div className="flex items-center gap-3">
        <span className={cn("grid size-12 shrink-0 place-items-center rounded-tile", soft, fg)}>
          <Icon className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold leading-tight text-ink">{a.title}</p>
          <p className="mt-0.5 truncate text-xs text-ink-mute">{a.when}</p>
          {a.isRace && <span className={cn(ui.chip, "mt-1")}><Flag className="size-3" aria-hidden />Compétition</span>}
        </div>
        {a.badge && <span className="shrink-0 rounded-full bg-brand/15 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-brand">{a.badge}</span>}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3">
        {a.metrics.slice(0, 3).map((m) => <Metric key={m.label} size="lg" label={m.label} value={m.value} unit={m.unit} />)}
      </dl>

      {a.zones && <ZoneBar zones={a.zones} compact className="mt-4" />}
      {a.tags && (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {a.tags.map((t) => <li key={t} className={ui.chip}>{t}</li>)}
        </ul>
      )}
      {a.insight && <InsightLine line={a.insight} className="mt-3" />}
      {a.effort
        ? <EffortStrip segments={a.effort.segments} label={a.effort.label} className="-mx-4 -mb-4 mt-4 w-[calc(100%_+_2rem)] rounded-b-card" />
        : (hasMap || a.ribbon) && (
          <div className="-mx-4 -mb-4 mt-4 w-[calc(100%_+_2rem)] overflow-hidden rounded-b-card">
            {hasMap && <RoutePreview points={a.route!} />}
            {a.ribbon && <ZoneRibbon segments={a.ribbon} />}
          </div>
        )}
    </>
  );
  const cls = cn(ui.card, ui.pressCard, "block w-full p-4 text-left");
  // Démo : pas de navigation. Un <div role="button"> car <button> n'accepte pas de blocs (dl, ul, p) à l'intérieur.
  if (onSelect)
    return (
      <div role="button" tabIndex={0} onClick={onSelect} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }} className={cn(cls, "cursor-pointer")}>
        {body}
      </div>
    );
  return <Link href={href ?? `/activities/${a.id}`} className={cls}>{body}</Link>;
}
