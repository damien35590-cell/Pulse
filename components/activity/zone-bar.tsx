import { cn } from "@/lib/utils";
import { fmtClock } from "@/lib/format";

/** Noms de classes complets (Tailwind ne génère que ce qu'il lit en entier dans le code). */
export const ZONE_BG = { 1: "bg-z1", 2: "bg-z2", 3: "bg-z3", 4: "bg-z4", 5: "bg-z5", 6: "bg-z6" } as const;
export const ZONE_TEXT = { 1: "text-z1", 2: "text-z2", 3: "text-z3", 4: "text-z4", 5: "text-z5", 6: "text-z6" } as const;
export type ZoneId = keyof typeof ZONE_BG;
export type ZoneSlice = { id: ZoneId; name: string; seconds: number; range?: string };

const pctTxt = (p: number) => `${Math.round(p)} %`;

/**
 * Temps par zone : barre empilée (lecture en 1 s) + détail par zone (lecture en 10 s).
 * 100 % CSS : net, léger, et il suit le thème (contrairement aux couleurs codées en dur dans Recharts).
 * `compact` : la barre seule, pour une carte de résumé.
 */
export function ZoneBar({ zones, compact = false, className }: { zones: ZoneSlice[]; compact?: boolean; className?: string }) {
  const total = zones.reduce((s, z) => s + z.seconds, 0) || 1;
  const pct = (s: number) => (s / total) * 100;
  const top = zones.reduce((a, b) => (b.seconds > a.seconds ? b : a), zones[0]);

  const bar = (
    <div
      role="img"
      aria-label={`Temps par zone : ${zones.map((z) => `Z${z.id} ${pctTxt(pct(z.seconds))}`).join(", ")}`}
      className={cn("flex gap-[3px] overflow-hidden rounded-full", compact ? "h-1.5" : "h-3")}
    >
      {zones.filter((z) => z.seconds > 0).map((z) => (
        <span key={z.id} className={cn("h-full first:rounded-l-full last:rounded-r-full", ZONE_BG[z.id])} style={{ width: `${pct(z.seconds)}%` }} />
      ))}
    </div>
  );
  if (compact) return <div className={className}>{bar}</div>;

  return (
    <div className={className}>
      {bar}
      <ul className="mt-5 space-y-3.5">
        {zones.map((z) => {
          const p = pct(z.seconds), isTop = z.id === top.id;
          return (
            <li key={z.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_3.25rem_2.75rem] items-center gap-3">
              <span className={cn("rounded-md py-0.5 text-center font-num text-[13px] font-bold text-black/80", ZONE_BG[z.id])}>Z{z.id}</span>
              <div className="min-w-0">
                <p className={cn("truncate text-sm", isTop ? "font-semibold text-ink" : "text-ink-soft")}>
                  {z.name}
                  {z.range && <span className="ml-1.5 font-num text-xs tabular-nums text-ink-mute">{z.range}</span>}
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div className={cn("h-full rounded-full", ZONE_BG[z.id])} style={{ width: `${p}%` }} />
                </div>
              </div>
              <span className="text-right font-num text-metric-sm tabular-nums text-ink">{fmtClock(z.seconds)}</span>
              <span className="text-right font-num text-sm tabular-nums text-ink-mute">{pctTxt(p)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
