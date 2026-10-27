"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Dumbbell, Mountain, Route, Zap } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { tap } from "@/lib/haptics";
import { activityStyle } from "@/lib/activity-style";
import { SPORT_SHORT } from "@/lib/sports";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";
import type { RecordRow, RecordSport, RecordsBySport } from "@/lib/analytics/records";

const STORAGE_KEY = "pulse:records-sport";

/** Pastille de chaque ligne, aux couleurs du sport : le code (5K, 10K, 21,1 ; code Lafay) s'il y en a un, sinon un pictogramme. */
function RecordTile({ row, sport }: { row: RecordRow; sport: RecordSport }) {
  const st = activityStyle(sport === "WORKOUT" ? "WORKOUT" : sport);
  return (
    <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-tile [&>svg]:size-5", st.soft, st.fg)}>
      {row.code ? <b className="font-num text-metric-sm tabular-nums">{row.code}</b> : row.key.endsWith("BEST_ELEVATION") ? <Mountain /> : row.key.endsWith("POWER20") ? <Zap /> : sport === "WORKOUT" ? <Dumbbell /> : <Route />}
    </span>
  );
}

/** Records personnels : un onglet par sport (Running d'abord, seulement ceux qui ont des records), le dernier choisi est retenu. */
export function RecordsTabs({ data, limit, moreHref }: { data: RecordsBySport; limit?: number; moreHref?: string }) {
  const [sport, setSport] = useState<RecordSport | null>(data.defaultSport);

  // Après l'hydratation : on reprend l'onglet choisi la dernière fois (le stockage peut être indisponible ou vide)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && data.sports.some((s) => s.sport === saved)) setSport(saved as RecordSport);
    } catch { /* stockage indisponible : on garde l'onglet par défaut */ }
  }, [data.sports]);

  if (!data.sports.length) return <p className="text-ink-soft">Tes records apparaîtront dès ta première sortie.</p>;

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
          size="lg"
          options={data.sports.map(({ sport: s }) => ({ value: s, label: <span>{SPORT_SHORT(s)}</span> }))}
        />
      )}
      <ul className={cn(ui.card, "divide-y divide-line overflow-hidden")}>
        {(limit ? current.rows.slice(0, limit) : current.rows).map((r) => {
          const body = (
            <>
              <RecordTile row={r} sport={current.sport} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base text-ink">{r.label}</span>
                <span className="block truncate text-sm text-ink-mute">{r.day}{r.sub ? ` · ${r.sub}` : ""}</span>
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
        {limit && moreHref && current.rows.length > limit && (
          <li>
            <Link href={moreHref} onClick={() => tap()} className={cn(ui.pressCard, "flex min-h-14 items-center gap-3 px-4 py-3")}>
              <span className="min-w-0 flex-1 font-semibold text-brand">Voir les {current.rows.length} records</span>
              <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </div>
  );
}
