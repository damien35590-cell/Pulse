import { cn } from "@/lib/utils";
import { fmtPaceS } from "@/lib/format";

/** `label` : bout final incomplet (« 0,4 »), à la place du numéro du km. */
export type Split = { km: number; paceS: number; hr?: number; elevM?: number; label?: string };

const COLS = "grid-cols-[1.75rem_minmax(0,1fr)_3.25rem_2.5rem]";

/**
 * Allure par kilomètre. Barre = vitesse relative (plus longue = plus rapide), le kilomètre le plus rapide ressort discrètement
 * (barre et chiffre en `ink`, les autres en `ink-soft`) : l'œil trouve le négatif split ou le coup de moins bien sans lire un chiffre.
 * Le Volt reste libre pour l'action principale de l'écran.
 */
export function Splits({ splits, className }: { splits: Split[]; className?: string }) {
  const full = splits.filter((s) => !s.label), paces = (full.length ? full : splits).map((s) => s.paceS);
  const fast = Math.min(...paces), slow = Math.max(...splits.map((s) => s.paceS));
  const width = (p: number) => Math.max(55, 100 - ((p - fast) / (slow - fast || 1)) * 45); // de 55 % (le plus lent) à 100 % (le plus rapide)
  const hasHr = splits.some((s) => s.hr != null);

  return (
    <div className={className}>
      <div className={cn("grid gap-3 px-1 pb-2 text-label uppercase text-ink-mute", COLS)}>
        <span>Km</span>
        <span aria-hidden />
        <span className="text-right">Allure</span>
        <span className="text-right">{hasHr ? "FC" : ""}</span>
      </div>
      <ol className="divide-y divide-line/60">
        {splits.map((s) => {
          const best = !s.label && s.paceS === fast;
          return (
            <li key={s.km} className={cn("grid h-11 items-center gap-3 px-1", COLS)} aria-label={best ? `Km ${s.km}, le plus rapide` : undefined}>
              <span className="font-num text-sm tabular-nums text-ink-mute">{s.label ?? s.km}</span>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={cn("h-full rounded-full", best ? "bg-ink" : "bg-ink-soft/40")} style={{ width: `${width(s.paceS)}%` }} />
              </div>
              <span className={cn("text-right font-num text-metric-sm tabular-nums", best ? "font-semibold text-ink" : "text-ink-soft")}>{fmtPaceS(s.paceS)}</span>
              <span className="text-right font-num text-sm tabular-nums text-ink-mute">{s.hr ?? ""}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
