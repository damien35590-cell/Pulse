import Link from "next/link";
import { routePath } from "@/lib/polyline";
import { SPORTS, sportColor } from "@/lib/sports";
import { fmtKm, fmtDuration, fmtPace } from "@/lib/format";

type A = { id: string; type: string; title: string; story: string | null; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; polyline: string | null };

/** Carte d'activité façon fil Strava : en-tête, titre, stats en colonnes, tracé orange. */
export function ActivityCard({ a, tz = "Europe/Paris" }: { a: A; tz?: string }) {
  const color = sportColor(a.type), r = a.polyline ? routePath(a.polyline, 320, 150, 14) : null;
  const Icon = (SPORTS[a.type] ?? SPORTS.OTHER).icon;
  const when = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(a.startedAt);
  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type);
  const stats = [
    a.type === "WORKOUT" ? null : { l: "Distance", v: fmtKm(a.distanceM), u: "km" },
    pace ? { l: pace.label, v: pace.value, u: pace.unit } : null,
    { l: "Durée", v: fmtDuration(a.movingTimeS), u: "" },
  ].filter(Boolean) as { l: string; v: string; u: string }[];

  return (
    <Link href={`/activities/${a.id}`} className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors active:bg-surface-2">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2"><Icon className="h-5 w-5" aria-hidden /></span>
        <div className="min-w-0">
          <p className="truncate text-[13px] capitalize text-ink-soft">{when}</p>
          <p className="truncate text-[17px] font-bold leading-tight">{a.title}</p>
        </div>
      </div>
      {a.story && <p className="px-4 pt-2.5 text-[15px] leading-snug">{a.story}</p>}
      <dl className="mt-3.5 flex px-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i ? "ml-4 border-l border-line pl-4" : ""}>
            <dt className="text-xs text-ink-soft">{s.l}</dt>
            <dd className="font-display text-[22px] font-bold leading-tight tabular-nums">{s.v}<span className="ml-0.5 text-sm font-medium text-ink-soft">{s.u}</span></dd>
          </div>
        ))}
      </dl>
      {r ? (
        <div className="relative mt-3.5 bg-surface-2">
          <svg viewBox="0 0 320 150" width="100%" height="150" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={r.d} stroke={color} strokeWidth="3.2" /><circle cx={r.end[0]} cy={r.end[1]} r="5" fill={color} stroke="rgb(var(--surface))" strokeWidth="2" />
          </svg>
          {a.elevationGainM > 0 && <span className="absolute bottom-2 left-3 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">D+ {Math.round(a.elevationGainM)} m</span>}
        </div>
      ) : <div className="h-4" />}
    </Link>
  );
}
