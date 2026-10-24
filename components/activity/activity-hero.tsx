"use client";
import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { TopoMapHeroLazy } from "@/components/activity/topo-map-lazy";
import { ElevationChart } from "@/components/activity/elevation-chart";
import { EditableTitle } from "@/components/activity/editable-title";
import { ActivityMenu } from "@/components/activity/activity-menu";
import { useTrackCursor } from "@/components/activity/activity-track";
import type { TrackPoint } from "@/components/activity/interactive-topo-map";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  title: string;
  /** Trace GPS : au moins 2 points pour afficher la carte. */
  points: TrackPoint[];
  gain?: number;
  /** Classe text-* de la courbe d'altitude (teinte du sport : la marque reste libre pour une seule mise en avant). */
  elevationColor?: string;
  /** Ligne sport · date, au-dessus du titre. */
  meta: React.ReactNode;
  /** Sous le titre : chiffres clés, comparaison… */
  children: React.ReactNode;
};

/**
 * Tête de fiche d'activité : carte plein cadre (~40 % de l'écran) sous une barre transparente (retour, renommer, « … »),
 * puis une carte à coins de feuille qui chevauche le bas de la carte (titre, méta, chiffres). Sans GPS : barre normale, même carte.
 * Le profil d'altitude suit la carte de contenu et partage son curseur avec la carte.
 */
export function ActivityHero({ id, title, points, gain, elevationColor, meta, children }: Props) {
  const [editing, setEditing] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null), titleRef = useRef<HTMLDivElement>(null);
  const hasMap = points.length > 1;
  const { profile, cursor, setCursorKm } = useTrackCursor(points);

  return (
    <>
      <TopBar
        title={title}
        back="/activities"
        backLabel="Activités"
        collapseAt={hasMap ? mapRef : titleRef}
        overlay={hasMap}
        actions={
          <>
            <button type="button" onClick={() => { tap(); setEditing(true); }} aria-label="Renommer l’activité" className={ui.iconBtn}>
              <Pencil className="size-5" aria-hidden />
            </button>
            <ActivityMenu id={id} />
          </>
        }
      />
      {hasMap && (
        // -mt-bar : la carte remonte sous la barre transparente, jusqu'au bord de l'écran.
        <div ref={mapRef} className="relative -mx-4 -mt-bar h-[40vh] min-h-64">
          <TopoMapHeroLazy hero points={points} cursor={cursor} />
        </div>
      )}
      <section className={cn(hasMap ? "relative z-10 -mx-4 -mt-6 rounded-t-sheet bg-bg px-4 pt-5" : "pt-1")}>
        {meta}
        <div ref={titleRef}>
          <EditableTitle activityId={id} title={title} editing={editing} onEditingChange={setEditing} />
        </div>
        {children}
      </section>
      {profile.length > 5 && (
        <Section title="Altitude" className="mt-8">
          <ElevationChart points={profile} gain={gain} color={elevationColor} onCursor={setCursorKm} />
        </Section>
      )}
    </>
  );
}
