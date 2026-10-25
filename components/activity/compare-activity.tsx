"use client";
import { useState } from "react";
import { ChevronRight, GitCompareArrows } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Delta } from "@/components/ui/metric";
import { fmtClock, fmtNum, fmtPace, fmtWhenShort } from "@/lib/format";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

/** Ce qu'il faut pour comparer deux sorties ; `startedAt` en ISO (passe du serveur au navigateur). */
export type Comparable = { id: string; title: string; type: string; startedAt: string; distanceM: number; movingTimeS: number; elevationGainM: number; avgHr: number | null };

const TZ = "Europe/Paris";
const when = (c: Comparable) => fmtWhenShort(new Date(c.startedAt), TZ);

/**
 * « Comparer » (zone d'actions de la fiche) : feuille qui liste les sorties comparables (même sport, distance à ±20 %), puis compare la sélection
 * à la sortie ouverte. Règle des couleurs : cette sortie (« maintenant ») en marque, l'autre (référence) en gris.
 */
export function CompareActivity({ current, candidates }: { current: Comparable; candidates: Comparable[] }) {
  const [open, setOpen] = useState(false), [picked, setPicked] = useState<string | null>(null);
  const other = candidates.find((c) => c.id === picked) ?? null;
  const close = () => { setOpen(false); setPicked(null); };
  return (
    <>
      <button type="button" onClick={() => { tap(); setOpen(true); }} aria-haspopup="dialog" className={cn(ui.btnSecondary, "w-full")}>
        <GitCompareArrows className="size-5" aria-hidden />Comparer
      </button>
      <BottomSheet open={open} onClose={close} title={other ? "Comparaison" : "Comparer avec…"}>
        {other ? (
          <Comparison a={current} b={other} onBack={() => setPicked(null)} />
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">Sorties du même sport, à ±20 % de la distance de celle-ci ({fmtNum(current.distanceM / 1000, 1)} km).</p>
            <ul className="mt-3 divide-y divide-surface-3">
              {candidates.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => { tap(); setPicked(c.id); }} className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:opacity-60">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{c.title}</span>
                      <span className="block truncate text-sm text-ink-soft">{when(c)} · {fmtNum(c.distanceM / 1000, 1)} km · {fmtClock(c.movingTimeS)}</span>
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-ink-mute" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </BottomSheet>
    </>
  );
}

type Row = { label: string; a: number; b: number; show: (v: number) => string; /** Texte de la valeur si ce n'est pas le nombre (allure). */ text?: (c: Comparable) => string };

function Comparison({ a, b, onBack }: { a: Comparable; b: Comparable; onBack: () => void }) {
  const speed = (c: Comparable) => (c.movingTimeS > 0 ? c.distanceM / c.movingTimeS : 0);
  const paceA = fmtPace(a.distanceM, a.movingTimeS, a.type), paceB = fmtPace(b.distanceM, b.movingTimeS, b.type);
  const rows: Row[] = [
    { label: "Distance", a: a.distanceM, b: b.distanceM, show: (v) => `${fmtNum(v / 1000, 1)} km` },
    { label: "Durée", a: a.movingTimeS, b: b.movingTimeS, show: fmtClock },
    // Les barres d'allure suivent la vitesse : plus longue = plus rapide
    ...(paceA && paceB ? [{ label: paceA.label, a: speed(a), b: speed(b), show: () => "", text: (c: Comparable) => { const p = fmtPace(c.distanceM, c.movingTimeS, c.type)!; return `${p.value} ${p.unit}`; } }] : []),
    { label: "Dénivelé +", a: a.elevationGainM, b: b.elevationGainM, show: (v) => `${fmtNum(v, 0)} m` },
    ...(a.avgHr && b.avgHr ? [{ label: "FC moy.", a: a.avgHr, b: b.avgHr, show: (v: number) => `${Math.round(v)} bpm` }] : []),
  ];
  const faster = speed(a) - speed(b);
  return (
    <div className="mt-2 space-y-4">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
        <li className="flex min-w-0 items-center gap-1.5"><i className="size-2.5 shrink-0 rounded-full bg-brand" aria-hidden /><span className="truncate">Cette sortie · {when(a)}</span></li>
        <li className="flex min-w-0 items-center gap-1.5"><i className="size-2.5 shrink-0 rounded-full bg-ink-mute" aria-hidden /><span className="truncate">{when(b)}</span></li>
      </ul>
      <div className="grid grid-cols-[88px_1fr] items-center gap-x-3 gap-y-4 text-sm">
        {rows.map((r) => {
          const m = Math.max(r.a, r.b, 0.01);
          return (
            <div key={r.label} className="contents">
              <span className="text-ink-soft">{r.label}</span>
              <div>
                <div className="h-3 rounded-md bg-brand" style={{ width: `${(r.a / m) * 100}%` }} />
                <div className="mt-1 h-3 rounded-md bg-ink-mute" style={{ width: `${(r.b / m) * 100}%` }} />
                <p className="mt-1 font-num tabular-nums text-ink">{r.text ? `${r.text(a)} / ${r.text(b)}` : `${r.show(r.a)} / ${r.show(r.b)}`}</p>
              </div>
            </div>
          );
        })}
      </div>
      {paceA && paceB && Math.abs(faster) > 0 && (
        <p className="text-sm text-ink-soft">
          <Delta tone={faster > 0 ? "good" : "neutral"}>{faster > 0 ? "Plus rapide" : "Plus lente"}</Delta> <span className="ml-1">que l’autre sortie.</span>
        </p>
      )}
      <button type="button" onClick={onBack} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>Choisir une autre sortie</button>
    </div>
  );
}
