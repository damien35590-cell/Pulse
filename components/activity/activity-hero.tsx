"use client";
import { useRef, useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { TopoMapLazy } from "@/components/activity/topo-map-lazy";
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
  /** Sous le titre (et la carte) : chiffres clés, comparaison… */
  children: React.ReactNode;
  /** Sections entre la tête et le profil d'altitude (note du coach, allure par km, FC). */
  sections?: React.ReactNode;
  /** Fond de tête sans carte : classe `from-*` d'un dégradé vers le transparent, posé derrière la barre du haut (muscu : `from-act-strength-soft`). */
  tint?: string;
};

/**
 * Tête de fiche d'activité : `TopBar` (retour, « … » qui porte Renommer et Supprimer), méta (sport · date), grand titre,
 * puis la carte du parcours dans une carte arrondie (même langage que la vignette du fil), Pente / Vitesse dessous ; rien sans GPS.
 * Les sections passées (`sections`) puis le profil d'altitude suivent ; le profil partage son curseur avec la carte.
 */
export function ActivityHero({ id, title, points, gain, elevationColor, meta, children, sections, tint }: Props) {
  const [editing, setEditing] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const hasMap = points.length > 1;
  const { profile, cursor, setCursorKm } = useTrackCursor(points);

  return (
    <>
      <TopBar
        title={title}
        back="/activities"
        backLabel="Activités"
        collapseAt={titleRef}
        transparent={!!tint}
        actions={<ActivityMenu id={id} onRename={() => setEditing(true)} />}
      />
      {tint && (
        // Remonte sous la barre transparente jusqu'au bord de l'écran ; -z-10 : derrière le contenu, jamais derrière un chiffre en couleur.
        <div aria-hidden className="pointer-events-none relative h-0">
          <div className={cn("absolute -inset-x-4 -top-bar -z-10 h-80 bg-gradient-to-b to-transparent", tint)} />
        </div>
      )}
      <section className="pt-1">
        {meta}
        <div ref={titleRef}>
          <EditableTitle activityId={id} title={title} editing={editing} onEditingChange={setEditing} />
        </div>
        {hasMap && <TopoMapLazy className="mt-4" points={points} cursor={cursor} />}
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
