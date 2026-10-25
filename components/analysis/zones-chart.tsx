import { fmtDayKey, fmtDuration } from "@/lib/format";
import { ZONES } from "@/lib/zones";
import { cn } from "@/lib/utils";

export type ZonesData = { kind: "power" | "hr"; ref: number; ftpManual: boolean; rides: number; weeks: { weekStart: string; seconds: number[] }[] };
// Noms de classes complets : Tailwind ne génère que ce qu'il lit en entier
const BG = ["bg-z1", "bg-z2", "bg-z3", "bg-z4", "bg-z5", "bg-z6"] as const;

/** Temps par zone et par semaine (puissance, sinon FC) : barres empilées aux tokens z1–z6, légende en mots. */
export function ZonesChart({ data }: { data: ZonesData }) {
  const { weeks, kind, ref, ftpManual, rides } = data;
  const tot = (w: ZonesData["weeks"][number]) => w.seconds.reduce((s, v) => s + v, 0);
  const max = Math.max(...weeks.map(tot), 1), n = weeks.length, step = n <= 6 ? 1 : Math.ceil(n / 6), gap = n > 40 ? "gap-px" : "gap-1";
  return (
    <div className="space-y-4">
      <div role="img" aria-label="Temps par zone et par semaine" className={cn("grid h-36 grid-flow-col auto-cols-fr items-end", gap)}>
        {weeks.map((w) => {
          const t = tot(w);
          return (
            <div key={w.weekStart} title={`Semaine du ${fmtDayKey(w.weekStart)} : ${fmtDuration(t)}`} className="flex h-full flex-col justify-end">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm" style={{ height: `${t ? Math.max(3, (t / max) * 100) : 0}%` }}>
                {w.seconds.map((s, i) => s > 0 && <div key={i} className={BG[i]} style={{ height: `${(s / t) * 100}%` }} />)}
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn("grid grid-flow-col auto-cols-fr text-xs text-ink-mute", gap)} aria-hidden>
        {weeks.map((w, i) => <span key={w.weekStart} className="flex justify-center whitespace-nowrap">{(n - 1 - i) % step === 0 ? fmtDayKey(w.weekStart) : ""}</span>)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        {ZONES.map((z, i) => <li key={z.id} className="flex items-center gap-1.5"><i className={cn("size-2.5 rounded-sm", BG[i])} aria-hidden />{z.label} {z.name}</li>)}
      </ul>
      <p className="text-xs text-ink-mute">
        {kind === "power" ? `Zones de puissance, FTP ${ref} W${ftpManual ? "" : " (estimée)"}` : `Zones de fréquence cardiaque, FC max ${ref} bpm`}, sur {rides} sortie{rides > 1 ? "s" : ""} récente{rides > 1 ? "s" : ""}.
      </p>
    </div>
  );
}
