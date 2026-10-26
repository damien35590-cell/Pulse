"use client";
import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUp, History, RefreshCw, Route, Split } from "lucide-react";
import type { HabitSport, HabitView, StoredClassic } from "@/lib/habits/build";
import type { Junction, Turn } from "@/lib/habits/grid";
import { classicTitle, turnWord } from "@/lib/habits/grid";
import { decodePolyline, routePath } from "@/lib/polyline";
import { durationMetric } from "@/lib/routes/view";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SPORT_SHORT } from "@/lib/sports";
import { ui } from "@/lib/ui";
import { tap } from "@/lib/haptics";
import { prepareClassic } from "@/app/actions";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { Metric } from "@/components/ui/metric";

const HeatMap = dynamic(() => import("./heat-map"), { ssr: false, loading: () => <div className="h-80 animate-pulse rounded-card bg-surface-2" /> });

type Props = { habits: Record<HabitSport, HabitView | null>; coverage: { withGps: number; total: number } };

const date = (iso: string) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }).format(new Date(iso));
const TURN_ICON: Record<Turn, typeof ArrowUp> = { left: ArrowLeft, straight: ArrowUp, right: ArrowRight };

type Progress = { until: string | null; added: number; step: "history" | "build" } | null;

/** Page Habitudes : traces GPS, carte de chaleur, classiques et bifurcations, par sport. */
export function HabitsView({ habits, coverage }: Props) {
  const router = useRouter();
  const [sport, setSport] = useState<HabitSport>(habits.RUN?.traces || !habits.RIDE?.traces ? "RUN" : "RIDE");
  const [selected, setSelected] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, startPreparing] = useTransition();
  const h = habits[sport];

  const classic = h?.classics.find((c) => c.id === selected) ?? null;
  const junction = h?.junctions.find((j) => j.id === selected) ?? null;
  const highlight = useMemo(() => (classic ? decodePolyline(classic.polyline) : null), [classic]);

  async function rebuild() {
    setProgress((p) => ({ until: p?.until ?? null, added: p?.added ?? 0, step: "build" }));
    const r = await fetch("/api/habits/build", { method: "POST" });
    if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? "Le calcul des habitudes a échoué.");
  }

  /** Historique Intervals par fenêtres de 60 jours (chaque appel < 60 s), puis recalcul des habitudes. */
  async function fetchHistory() {
    tap(10); setError(null);
    let before: string | undefined, added = 0;
    setProgress({ until: null, added: 0, step: "history" });
    try {
      for (let i = 0; i < 40; i++) {
        const r = await fetch("/api/sync/intervals/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ before }) });
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error ?? "Intervals.icu n'a pas répondu.");
        added += (j.saved ?? 0) + (j.backfilled ?? 0);
        setProgress({ until: j.next, added, step: "history" });
        if (j.done || !j.next) break;
        before = j.next;
      }
      await rebuild();
      setProgress(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setProgress(null);
    }
  }

  async function recompute() {
    tap(8); setError(null);
    try { await rebuild(); setProgress(null); router.refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Erreur"); setProgress(null); }
  }

  function prepare(c: StoredClassic) {
    tap(10);
    startPreparing(async () => {
      const r = await prepareClassic(sport, c.id);
      if (r.ok) router.push(`/itineraires/${r.id}`); else setError("Ce classique n'existe plus : recalcule tes habitudes.");
    });
  }

  const busy = !!progress;
  return (
    <div className="space-y-8">
      <Segmented options={[{ value: "RUN", label: SPORT_SHORT("RUN") }, { value: "RIDE", label: "Vélo" }]} value={sport} onChange={(s) => { setSport(s); setSelected(null); }} />

      <Section title="Tes traces GPS">
        <div className={cn(ui.card, "space-y-3 p-4")}>
          <dl className="grid grid-cols-2 gap-3">
            <Metric label="Avec GPS" value={fmtNum(coverage.withGps, 0)} unit={`/ ${fmtNum(coverage.total, 0)}`} />
            <Metric label={sport === "RUN" ? "Courses lues" : "Sorties vélo lues"} value={fmtNum(h?.traces ?? 0, 0)} />
          </dl>
          <p className="text-sm text-ink-soft">
            Pulse apprend tes chemins à partir des traces GPS. Les sorties arrivées par Strava sur Intervals n&apos;ont pas de fichier : elles restent sans trace.
          </p>
          {progress && (
            <p className="text-sm text-ink" aria-live="polite">
              {progress.step === "history"
                ? `Récupération… ${progress.until ? `jusqu'au ${date(progress.until)}` : ""} · ${progress.added} trace${progress.added > 1 ? "s" : ""} ajoutée${progress.added > 1 ? "s" : ""}`
                : "Calcul de tes habitudes…"}
            </p>
          )}
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <button type="button" onClick={fetchHistory} disabled={busy} className={cn(ui.btnSecondary, "w-full")}>
            <History className="size-5" aria-hidden />{busy ? "En cours… (garde la page ouverte)" : "Récupérer l'historique Intervals"}
          </button>
          <button type="button" onClick={recompute} disabled={busy} className="flex h-12 w-full touch-manipulation items-center justify-center gap-2 text-sm font-semibold text-brand active:opacity-60 disabled:opacity-40">
            <RefreshCw className="size-4" aria-hidden />Recalculer{h ? ` · calculé le ${date(h.builtAt)}` : ""}
          </button>
        </div>
      </Section>

      {!h || !h.cells.length ? (
        <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>
          Pas encore de trace GPS en {sport === "RUN" ? "course" : "vélo"}. Récupère l&apos;historique, ou importe un fichier FIT ou GPX.
        </p>
      ) : (
        <>
          <Section title="Ta carte de chaleur">
            <HeatMap lat0={h.lat0} cellM={h.cellM} cells={h.cells} junctions={h.junctions} highlight={highlight} focus={junction} />
            <p className="px-1 text-xs text-ink-mute">Plus c&apos;est foncé, plus tu y passes. Points jaunes : tes bifurcations.</p>
          </Section>

          <Section title="Tes classiques" action={<span className="font-num text-sm tabular-nums text-ink-mute">{h.classics.length}</span>}>
            {h.classics.length ? (
              <div className="space-y-3">
                {h.classics.map((c) => (
                  <ClassicCard key={c.id} c={c} active={selected === c.id} onSelect={() => { tap(6); setSelected(selected === c.id ? null : c.id); }} onPrepare={() => prepare(c)} preparing={preparing} />
                ))}
              </div>
            ) : (
              <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>Un parcours devient un classique dès que tu l&apos;as fait 3 fois.</p>
            )}
          </Section>

          <Section title="Tes bifurcations" action={<span className="font-num text-sm tabular-nums text-ink-mute">{h.junctions.length}</span>}>
            {h.junctions.length ? (
              <div className="space-y-3">
                {h.junctions.map((j) => <JunctionCard key={j.id} j={j} active={selected === j.id} onSelect={() => { tap(6); setSelected(selected === j.id ? null : j.id); }} />)}
              </div>
            ) : (
              <p className={cn(ui.card, "p-4 text-sm text-ink-soft")}>Une bifurcation apparaît quand au moins 4 sorties arrivées par le même chemin s&apos;y séparent.</p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function ClassicCard({ c, active, onSelect, onPrepare, preparing }: { c: StoredClassic; active: boolean; onSelect: () => void; onPrepare: () => void; preparing: boolean }) {
  const path = useMemo(() => routePath(c.polyline, 64, 64, 6), [c.polyline]);
  const t = durationMetric(c.medianMovingS / 60), best = durationMetric(c.bestMovingS / 60);
  return (
    <div className={cn(ui.card, "p-4", active && "ring-2 ring-brand")}>
      <button type="button" onClick={onSelect} aria-pressed={active} className="flex w-full touch-manipulation items-center gap-3 text-left active:opacity-70">
        <svg viewBox="0 0 64 64" className="size-16 shrink-0 rounded-tile bg-surface-2" aria-hidden>
          {path && <path d={path.d} fill="none" stroke="rgb(var(--brand))" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        </svg>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{classicTitle(c)}</span>
          <span className="block text-xs text-ink-mute">Faite {c.count} fois · dernière fois le {date(c.lastAt)}</span>
        </span>
      </button>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <Metric size="sm" label="Distance" value={fmtNum(c.distanceM / 1000, 1)} unit="km" />
        <Metric size="sm" label="Temps habituel" value={t.value} unit={t.unit} />
        <Metric size="sm" label="Meilleur" value={best.value} unit={best.unit} />
      </dl>
      <button type="button" onClick={onPrepare} disabled={preparing} className={cn(ui.btnSecondary, "mt-3 w-full")}>
        <Route className="size-5" aria-hidden />{preparing ? "Préparation…" : "Préparer cette boucle"}
      </button>
    </div>
  );
}

function JunctionCard({ j, active, onSelect }: { j: Junction; active: boolean; onSelect: () => void }) {
  const branches = [...j.branches].sort((a, b) => b.count - a.count);
  return (
    <button type="button" onClick={onSelect} aria-pressed={active} className={cn(ui.card, ui.pressCard, "block w-full p-4 text-left", active && "ring-2 ring-brand")}>
      <span className="flex items-center gap-2">
        <Split className="size-4 shrink-0 text-warn" aria-hidden />
        <span className="truncate font-semibold text-ink">{j.name ? `Près de ${j.name}` : "Bifurcation"}</span>
      </span>
      <span className="mt-3 block space-y-2">
        {branches.map((b) => {
          const Icon = TURN_ICON[b.turn], pct = Math.round((b.count / j.total) * 100);
          return (
            <span key={`${b.turn}-${b.bearing}`} className="flex items-center gap-3">
              <Icon className="size-4 shrink-0 text-ink-soft" aria-hidden />
              <span className="w-20 shrink-0 text-sm text-ink-soft first-letter:uppercase">{turnWord(b.turn)}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-16 shrink-0 text-right font-num text-sm tabular-nums text-ink">{b.count}<span className="text-ink-mute"> / {j.total}</span></span>
            </span>
          );
        })}
      </span>
    </button>
  );
}
