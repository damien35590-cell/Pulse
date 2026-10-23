"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { tap } from "@/lib/haptics";
import { SPORTS } from "@/lib/sports";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { RecordSport, RecordsBySport } from "@/lib/analytics/records";

const TAB_LABEL: Record<RecordSport, string> = { RUN: "Course", RIDE: "Vélo", WORKOUT: "Muscu", HIKE: "Rando" };
const STORAGE_KEY = "pulse:records-sport";

/** Records personnels : un onglet par sport (seulement ceux qui ont des records), le dernier choisi est retenu. */
export function RecordsTabs({ data }: { data: RecordsBySport }) {
  const [sport, setSport] = useState<RecordSport | null>(data.defaultSport);

  // Après l'hydratation : on reprend l'onglet choisi la dernière fois (le stockage peut être indisponible ou vide)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && data.sports.some((s) => s.sport === saved)) setSport(saved as RecordSport);
    } catch { /* stockage indisponible : on garde l'onglet par défaut */ }
  }, [data.sports]);

  if (!data.sports.length) return <p className="text-ink-soft">Vos records apparaîtront dès votre première sortie.</p>;

  const current = data.sports.find((s) => s.sport === sport) ?? data.sports[0];
  const choose = (v: RecordSport) => {
    setSport(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* sans conséquence */ }
  };

  return (
    <div className="space-y-3">
      {data.sports.length > 1 && (
        <Segmented
          value={current.sport}
          onChange={choose}
          options={data.sports.map(({ sport: s }) => {
            const Icon = SPORTS[s].icon;
            return { value: s, label: <span className="inline-flex items-center justify-center gap-1.5"><Icon className="size-4 shrink-0" aria-hidden />{TAB_LABEL[s]}</span> };
          })}
        />
      )}
      <ul className={cn(ui.card, "divide-y divide-line overflow-hidden")}>
        {current.rows.map((r) => {
          const body = (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base text-ink">{r.label}</span>
                <span className="block text-label uppercase text-ink-mute">{r.day}{r.sub ? ` · ${r.sub}` : ""}</span>
              </span>
              <span className="shrink-0 text-right">
                <b className="font-num text-metric-lg tabular-nums text-ink">{r.value}</b>
                {r.unit && <span className="ml-1 text-sm text-ink-soft">{r.unit}</span>}
              </span>
            </>
          );
          return (
            <li key={r.key}>
              {r.activityId ? (
                <Link href={`/activities/${r.activityId}`} onClick={() => tap()} className={cn(ui.pressCard, "flex min-h-14 items-center gap-3 px-4 py-3")}>
                  {body}
                  <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
                </Link>
              ) : (
                <div className="flex min-h-14 items-center gap-3 px-4 py-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
