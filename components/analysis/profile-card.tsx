"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { tap } from "@/lib/haptics";
import { fmtNum } from "@/lib/format";
import type { Axis } from "@/lib/radar";
import { useThemeColors } from "@/lib/use-theme-colors";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

const DISCIPLINES = [
  { k: "RIDE", tab: "Vélo", name: "cyclisme", empty: "Aucune séance de vélo avec données détaillées sur 90 jours.", unit: "sortie" },
  { k: "RUN", tab: "Running", name: "running", empty: "Aucune sortie running sur 90 jours.", unit: "sortie" },
  { k: "HIKE", tab: "Rando", name: "randonnée", empty: "Aucune randonnée sur 90 jours.", unit: "sortie" },
  { k: "WORKOUT", tab: "Muscu", name: "musculation", empty: "Aucune séance de musculation sur 90 jours.", unit: "séance" },
] as const;
type Key = (typeof DISCIPLINES)[number]["k"];
const MIN_AXES = 3; // sous 3 axes, un radar n'est plus un polygone

/**
 * Bloc « Profil » : radar de la discipline (celle du filtre ; sur « Tous », un onglet par discipline). Les axes sans donnée ne sont pas tracés
 * (une phrase dit lesquels manquent). Un toucher sur la carte ouvre la liste des scores.
 * `perWeek` : sorties par semaine de la période (même calcul que le coach), qui remplace la fréquence affichée à l'axe Régularité.
 */
export function ProfileCard({ profiles, sport, perWeek }: { profiles: Record<Key, Axis[] | null>; sport: string; perWeek: Partial<Record<Key, number | null>> }) {
  const c = useThemeColors();
  const fixed = DISCIPLINES.find((d) => d.k === sport);
  const available = DISCIPLINES.filter((d) => profiles[d.k]);
  const [tab, setTab] = useState<Key>(available[0]?.k ?? "RIDE");
  const [open, setOpen] = useState(false);
  const cur = fixed ?? DISCIPLINES.find((d) => d.k === tab)!;
  const axes = (profiles[cur.k] ?? []).map((a) => {
    const pw = perWeek[cur.k];
    return a.axis === "Régularité" && pw != null ? { ...a, raw: `${fmtNum(pw, 1)} ${cur.unit}${pw >= 2 ? "s" : ""} par semaine` } : a;
  });
  const shown = axes.filter((a) => !a.missing), missing = axes.filter((a) => a.missing);
  const tick = { fontSize: 11, fill: c.inkMute };

  return (
    <Section title="Profil">
      <div className={cn(ui.card, "p-4")}>
        {!fixed && available.length > 1 && <Segmented className="mb-3" options={available.map((d) => ({ value: d.k, label: d.tab }))} value={cur.k} onChange={setTab} />}
        {!axes.length ? (
          <p className="py-8 text-center text-sm text-ink-soft">{cur.empty}</p>
        ) : (
          <>
            <button type="button" onClick={() => { tap(); setOpen(true); }} aria-haspopup="dialog" className={cn(ui.pressCard, "block w-full rounded-tile text-left")}>
              {shown.length >= MIN_AXES ? (
                <div className="h-64" role="img" aria-label={`Profil ${cur.name}`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={shown} outerRadius="68%">
                      <PolarGrid stroke={c.inkMute} strokeOpacity={0.35} />
                      <PolarAngleAxis dataKey="axis" tick={tick} />
                      <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar dataKey="value" stroke={c.brandText} strokeWidth={2.5} fill={c.brand} fillOpacity={0.28} isAnimationActive={false} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-ink-soft">Pas assez de données pour tracer le profil {cur.name}.</p>
              )}
              <span className="flex min-h-12 items-center justify-between gap-2 px-1 text-sm font-semibold text-brand">Voir les scores<ChevronRight className="size-4" aria-hidden /></span>
            </button>
            {missing.length > 0 && <p className="mt-1 px-1 text-sm text-ink-soft">{missing.map((a) => a.note ?? `${a.axis} : pas de données`).join(" · ")}</p>}
          </>
        )}
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={`Profil ${cur.name}`}>
        <ul className="mt-2 divide-y divide-surface-3 text-sm">
          {axes.map((a) => (
            <li key={a.axis} className="flex items-baseline justify-between gap-3 py-3">
              <span>{a.axis}</span>
              <span className="text-right text-ink-soft">
                {a.missing ? "pas de données" : <><b className="font-num text-metric-sm text-ink">{a.value}</b> · {a.raw}</>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-mute">Scores de 0 à 100 sur 90 jours, entre des repères fixes : ils servent à suivre ton évolution, pas à te comparer. La fréquence suit la période affichée.</p>
      </BottomSheet>
    </Section>
  );
}
