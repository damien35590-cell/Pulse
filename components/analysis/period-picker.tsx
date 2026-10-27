"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { NumberStepper } from "@/components/ui/number-stepper";
import { MAX_WEEKS, PRESETS, periodLabel, weeksBetween, weeksLabel } from "@/lib/analysis/period";
import { shiftDay } from "@/lib/dates";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

const STORE = "pulse.analysis.period";
type Props = { weeks: number; current: boolean; endKey: string; startKey: string; preset: number | null; today: string };

/**
 * Choix de la période de la page Analyse : raccourcis (4 sem. → 1 an) ou période libre (nombre de semaines + date de fin, ou deux dates).
 * La période vit dans l'URL (?w=&to=) ; le dernier choix est retenu dans le navigateur et rechargé quand l'URL n'en donne pas.
 */
export function PeriodPicker({ weeks, current, endKey, startKey, preset, today }: Props) {
  const router = useRouter(), path = usePathname(), sp = useSearchParams();
  const [open, setOpen] = useState(false);
  const [w, setW] = useState(weeks), [to, setTo] = useState(endKey), [from, setFrom] = useState(startKey);

  const go = (weeksN: number, toKey: string | null, replace = false) => {
    const p = new URLSearchParams(sp.toString());
    p.set("w", String(weeksN));
    if (toKey && toKey < today) p.set("to", toKey); else p.delete("to");
    p.delete("a"); p.delete("b"); // les sorties comparées appartenaient à l'ancienne période
    try { localStorage.setItem(STORE, JSON.stringify({ w: weeksN, to: p.get("to") })); } catch { /* stockage indisponible */ }
    (replace ? router.replace : router.push)(`${path}?${p}`, { scroll: false });
  };

  // Pas de période dans l'URL : on reprend le dernier choix
  useEffect(() => {
    if (sp.has("w")) return;
    try {
      const s = JSON.parse(localStorage.getItem(STORE) ?? "null") as { w?: number; to?: string | null } | null;
      if (s?.w && (s.w !== 12 || s.to)) go(s.w, s.to ?? null, true);
    } catch { /* rien de mémorisé */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openSheet = () => { setW(weeks); setTo(endKey); setFrom(startKey); setOpen(true); };
  const options = [...PRESETS.map((p) => ({ value: String(p.weeks), label: p.label })), { value: "custom", label: "Perso" }];
  const jan1 = `${today.slice(0, 4)}-01-01`, lastYear = String(Number(today.slice(0, 4)) - 1);
  const shortcuts: { label: string; w: number; to: string | null }[] = [
    { label: "Cette année", w: weeksBetween(jan1, today), to: null },
    { label: `Année ${lastYear}`, w: weeksBetween(`${lastYear}-01-01`, `${lastYear}-12-31`), to: `${lastYear}-12-31` },
    { label: "8 sem.", w: 8, to: null },
    { label: "2 ans", w: MAX_WEEKS, to: null },
  ];
  const apply = (weeksN: number, toKey: string | null) => { setOpen(false); go(weeksN, toKey); };
  const fromDates = weeksBetween(from, to);

  return (
    <>
      {/* Collé sous la barre au défilement, comme les filtres d'Activités */}
      <div className="sticky top-bar z-20 -mx-4 bg-bg/80 px-4 py-1 backdrop-blur-xl">
        <Segmented
          options={options}
          value={preset ? String(preset) : "custom"}
          onChange={(v) => (v === "custom" ? openSheet() : go(Number(v), null))}
        />
      </div>
      <button type="button" onClick={openSheet} className={cn(ui.pressCard, "mt-2 flex min-h-12 w-full items-center gap-2 rounded-tile px-1 text-left text-sm text-ink-soft")}>
        <CalendarRange className="size-4 shrink-0 text-ink-mute" aria-hidden />
        <span className="flex-1">{periodLabel({ startKey, endKey })}</span>
        <span className="font-num tabular-nums text-ink-mute">{weeksLabel(weeks)}</span>
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Période d'analyse">
        <p className="mt-1 text-sm text-ink-soft">Semaines entières, du lundi au dimanche. Comparaison avec la période précédente de même durée.</p>

        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto overscroll-contain px-4">
          {shortcuts.map((s) => (
            <button key={s.label} type="button" onClick={() => apply(s.w, s.to)} className="inline-flex h-12 shrink-0 items-center rounded-full bg-surface-3 px-4 text-sm font-medium active:scale-[0.97]">
              {s.label}
            </button>
          ))}
        </div>

        <h3 className={cn(ui.label, "mt-6")}>Durée et fin</h3>
        <NumberStepper className="mt-2" label="Durée" value={w} onChange={setW} min={1} max={MAX_WEEKS} unit={w > 1 ? "semaines" : "semaine"} />
        <label className="mt-2 flex min-h-14 items-center justify-between gap-3 rounded-tile bg-surface px-4 shadow-card">
          <span className={ui.label}>Jusqu'au</span>
          <input type="date" value={to} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} className="bg-transparent text-right font-num text-metric-sm text-ink" />
        </label>
        <p className="mt-2 text-sm text-ink-soft">{periodLabel({ startKey: shiftDay(mondayOf(to), -7 * (w - 1)), endKey: to >= today ? today : shiftDay(mondayOf(to), 6) })}</p>
        <button type="button" onClick={() => apply(w, to)} className={cn(ui.btnPrimary, "mt-4 w-full")}>Afficher {weeksLabel(w)}</button>

        <h3 className={cn(ui.label, "mt-8")}>Ou entre deux dates</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([["Du", from, setFrom], ["Au", to, setTo]] as const).map(([l, v, set]) => (
            <label key={l} className="flex min-h-14 flex-col justify-center rounded-tile bg-surface px-3 shadow-card">
              <span className={ui.label}>{l}</span>
              <input type="date" value={v} max={today} onChange={(e) => e.target.value && set(e.target.value)} className="bg-transparent font-num text-metric-sm text-ink" />
            </label>
          ))}
        </div>
        <button type="button" onClick={() => apply(fromDates, to >= from ? to : from)} className={cn(ui.btnSecondary, "mt-3 w-full bg-surface-3")}>
          Afficher ces dates ({weeksLabel(fromDates)})
        </button>
      </BottomSheet>
    </>
  );
}

function mondayOf(k: string) {
  const d = new Date(k + "T12:00:00Z"), dow = (d.getUTCDay() + 6) % 7;
  return shiftDay(k, -dow);
}
