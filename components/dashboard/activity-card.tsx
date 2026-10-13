import Link from "next/link";
import { routePath } from "@/lib/polyline";
import { SPORTS, sportColor } from "@/lib/sports";
import { fmtKm, fmtDuration, fmtNum, fmtPace } from "@/lib/format";

type A = {
  id: string; type: string; title: string; story: string | null; startedAt: Date; distanceM: number; movingTimeS: number; elevationGainM: number; polyline: string | null;
  avgHr?: number | null; avgPower?: number | null; exercises?: { sets: number; reps: number; loadKg: number | null }[];
};
type Cell = { l: string; v: string; u?: string };

/** Les 4 chiffres les plus utiles selon le sport : D+ pour le trail, puissance pour le vélo, volume pour la muscu… */
function cells(a: A): Cell[] {
  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type);
  const dist: Cell = { l: "Distance", v: fmtKm(a.distanceM), u: "km" }, dur: Cell = { l: "Durée", v: fmtDuration(a.movingTimeS) };
  const dplus = a.elevationGainM > 0 ? { l: "D+", v: fmtNum(a.elevationGainM, 0), u: "m" } : null;
  const hr = a.avgHr ? { l: "FC moy.", v: String(Math.round(a.avgHr)), u: "bpm" } : null;
  const pw = a.avgPower ? { l: "Puissance", v: String(Math.round(a.avgPower)), u: "W" } : null;
  const sp = pace ? { l: pace.label, v: pace.value, u: pace.unit } : null;
  let list: (Cell | null)[];
  if (a.type === "WORKOUT") {
    const ex = a.exercises ?? [], sets = ex.reduce((s, e) => s + e.sets, 0), vol = ex.reduce((s, e) => s + e.sets * e.reps * (e.loadKg ?? 0), 0);
    list = [dur, ex.length ? { l: "Exercices", v: String(ex.length) } : null, sets ? { l: "Séries", v: String(sets) } : null, vol > 0 ? { l: "Volume", v: vol >= 1000 ? fmtNum(vol / 1000, 1) : String(Math.round(vol)), u: vol >= 1000 ? "t" : "kg" } : null, hr];
  } else if (a.type === "RIDE") list = [dist, dur, pw, dplus, hr, sp];
  else if (a.type === "HIKE") list = [dist, dplus, dur, hr, sp];
  else if (a.type === "RUN") list = [dist, dur, sp, dplus, hr];
  else list = [dist, dur, dplus, hr];
  return list.filter((c): c is Cell => c !== null).slice(0, 4);
}
const COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

export function ActivityCard({ a, tz = "Europe/Paris" }: { a: A; tz?: string }) {
  const color = sportColor(a.type), r = a.polyline ? routePath(a.polyline, 320, 110, 12) : null, Icon = (SPORTS[a.type] ?? SPORTS.OTHER).icon;
  const when = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(a.startedAt);
  const grid = cells(a);
  return (
    <Link href={`/activities/${a.id}`} className="block overflow-hidden rounded-xl border border-line bg-surface transition-colors active:bg-surface-2">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2"><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
        <div className="min-w-0">
          <p className="truncate text-[12px] capitalize text-ink-soft">{when}</p>
          <p className="truncate text-base font-bold leading-tight">{a.title}</p>
        </div>
      </div>
      {a.story && <p className="line-clamp-2 px-4 pt-1.5 text-[12.5px] leading-snug text-ink-soft">{a.story}</p>}
      <dl className={`mt-3 grid divide-x divide-line border-y border-line ${COLS[grid.length] ?? "grid-cols-4"}`}>
        {grid.map((c) => (
          <div key={c.l} className="min-w-0 px-3 py-2">
            <dt className="truncate text-[11px] text-ink-soft">{c.l}</dt>
            <dd className="font-display text-[19px] font-bold leading-tight tabular-nums">{c.v}{c.u && <span className="ml-0.5 text-[11px] font-medium text-ink-soft">{c.u}</span>}</dd>
          </div>
        ))}
      </dl>
      {r && (
        <div className="bg-surface-2">
          <svg viewBox="0 0 320 110" width="100%" height="110" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={r.d} stroke={color} strokeWidth="3.2" /><circle cx={r.end[0]} cy={r.end[1]} r="5" fill={color} stroke="rgb(var(--surface))" strokeWidth="2" />
          </svg>
        </div>
      )}
    </Link>
  );
}
