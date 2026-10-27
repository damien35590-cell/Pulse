"use client";
import { useRef, useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { TopoMapHeroLazy } from "@/components/activity/topo-map-lazy";
import { ElevationChart } from "@/components/activity/elevation-chart";
import { EditableTitle } from "@/components/activity/editable-title";
import { ActivityMenu } from "@/components/activity/activity-menu";
import { useTrackCursor } from "@/components/activity/activity-track";
import type { TrackPoint } from "@/components/activity/interactive-topo-map";
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
  /** Sections entre la carte de contenu et le profil d'altitude (note du coach, allure par km, FC). */
  sections?: React.ReactNode;
};

/**
 * Tête de fiche d'activité : carte plein cadre (~40 % de l'écran) sous une barre transparente (retour, « … » qui porte Renommer et Supprimer),
 * puis une carte à coins de feuille qui chevauche le bas de la carte (titre, méta, chiffres). Sans GPS : barre normale, même carte.
 * Les sections passées (`sections`) puis le profil d'altitude suivent la carte de contenu ; le profil et partage son curseur avec la carte.
 */
export function ActivityHero({ id, title, points, gain, elevationColor, meta, children, sections }: Props) {
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
        actions={<ActivityMenu id={id} onRename={() => setEditing(true)} />}
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
      <div className="mt-8 space-y-8 empty:hidden">
        {sections}
        {profile.length > 5 && (
          <Section title="Altitude">
            <div className={cn(ui.card, "p-4")}>
              <ElevationChart points={profile} gain={gain} color={elevationColor} onCursor={setCursorKm} />
            </div>
          </Section>
        )}
      </div>
    </>
  );
}
