"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Link2, Unlink } from "lucide-react";
import type { SessionStatus } from "@prisma/client";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { completePlannedSession, detachPlannedSession, linkRunToSession, reopenPlannedSession, weekRunsForSession } from "@/app/actions";
import type { LinkableSession, WeekRun } from "@/lib/data/training";
import { fmtDuration, fmtKm, fmtPace } from "@/lib/format";
import { tap } from "@/lib/haptics";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

const TZ = "Europe/Paris";
const dayOf = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
const plannedDay = (key: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
const row = "flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-tile bg-surface-3 px-4 py-2 text-left transition active:scale-[0.985] disabled:opacity-60";

/** Lance une action serveur ; en cas de succès, ferme la feuille et rafraîchit la page. */
function useRun(onDone: () => void) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const r = await f();
    if (!r.ok) { setErr(r.error ?? "Action impossible."); return; }
    setErr(null); onDone(); router.refresh();
  });
  return { pending, err, run };
}

/** Une sortie de la semaine : jour, distance, durée, allure. */
function RunLine({ r }: { r: WeekRun }) {
  const pace = fmtPace(r.distanceM, r.movingTimeS, "RUN");
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-ink first-letter:uppercase">{dayOf(r.startedAt)}</span>
      <span className="block font-num text-sm tabular-nums text-ink-soft">
        {fmtKm(r.distanceM)} km · {fmtDuration(r.movingTimeS)}{pace ? ` · ${pace.value} ${pace.unit}` : ""}
      </span>
      {r.linkedTo && <span className="block truncate text-xs text-ink-mute">Valide déjà « {r.linkedTo} » : la choisir l’y retire</span>}
    </span>
  );
}

export type TapSession = { id: string; title: string; date: string; status: SessionStatus; activityId: string | null };

/**
 * Ligne de séance de la page Programme rendue touchable : ouvre « Valider avec… » (toutes les sorties course de la semaine, y compris
 * celles qui valident une autre séance : les choisir les déplace,
 * « Faite sans activité enregistrée »), ou, pour une séance déjà faite, de quoi la détacher / la remettre à faire.
 */
export function SessionTap({ s, children, className }: { s: TapSession; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ runs: WeekRun[] } | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const { pending, err, run } = useRun(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    let live = true;
    setData(null); setLoadErr(null);
    weekRunsForSession(s.id).then((r) => { if (live) r.ok ? setData({ runs: r.runs }) : setLoadErr(r.error); }, () => live && setLoadErr("Chargement impossible."));
    return () => { live = false; };
  }, [open, s.id]);

  const done = s.status === "COMPLETED";
  return (
    <>
      <button type="button" onClick={() => { tap(); setOpen(true); }} aria-haspopup="dialog" className={cn("touch-manipulation text-left transition active:opacity-70", className)}>
        {children}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Valider avec…">
        <p className="mt-1 text-sm text-ink-soft">{s.title} · prévue {plannedDay(s.date)}</p>
        <p className={cn(ui.label, "mt-5")}>Tes sorties de la semaine</p>
        {loadErr ? (
          <p role="alert" className="mt-2 text-sm text-bad">{loadErr}</p>
        ) : !data ? (
          <p className="mt-2 text-sm text-ink-mute">Chargement…</p>
        ) : data.runs.length ? (
          <ul className="mt-2 grid gap-2">
            {data.runs.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  disabled={pending || r.linked}
                  onClick={() => { tap(10); run(() => linkRunToSession(s.id, r.id)); }}
                  aria-label={r.linked ? undefined : `Valider avec la sortie du ${dayOf(r.startedAt)}`}
                  className={cn(row, r.linked && "ring-1 ring-inset ring-good/60 disabled:opacity-100")}
                >
                  <RunLine r={r} />
                  {r.linked ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-good"><Check className="size-4" strokeWidth={3} aria-hidden />Liée</span> : <Link2 className="size-5 shrink-0 text-ink-mute" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-mute">Aucune sortie course cette semaine.</p>
        )}
        {err && <p role="alert" className="mt-3 text-sm font-medium text-bad">{err}</p>}
        <div className="mt-6 grid gap-2">
          {!done && (
            <button type="button" disabled={pending} onClick={() => { tap(10); run(() => completePlannedSession(s.id)); }} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>
              <Check className="size-5" aria-hidden />Faite sans activité enregistrée
            </button>
          )}
          {done && s.activityId && (
            <button type="button" disabled={pending} onClick={() => { tap(10); run(() => detachPlannedSession(s.id)); }} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>
              <Unlink className="size-5" aria-hidden />Détacher la sortie
            </button>
          )}
          {done && !s.activityId && (
            <button type="button" disabled={pending} onClick={() => { tap(10); run(() => reopenPlannedSession(s.id)); }} className={cn(ui.btnSecondary, "w-full bg-surface-3")}>
              Remettre à faire
            </button>
          )}
        </div>
      </BottomSheet>
    </>
  );
}

/** Fiche d'une sortie course qui ne valide aucune séance : « Rattacher à une séance du programme » (séances encore à faire de sa semaine). */
export function AttachRun({ activityId, sessions }: { activityId: string; sessions: LinkableSession[] }) {
  const [open, setOpen] = useState(false);
  const { pending, err, run } = useRun(() => setOpen(false));
  return (
    <>
      <button type="button" onClick={() => { tap(); setOpen(true); }} className="inline-flex min-h-12 items-center gap-1.5 text-sm font-semibold text-brand">
        <Link2 className="size-4" aria-hidden />Rattacher à une séance du programme
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Rattacher à une séance">
        <p className="mt-1 text-sm text-ink-soft">Séances encore à faire cette semaine-là.</p>
        <ul className="mt-4 grid gap-2">
          {sessions.map((x) => (
            <li key={x.id}>
              <button type="button" disabled={pending} onClick={() => { tap(10); run(() => linkRunToSession(x.id, activityId)); }} className={row}>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 truncate font-semibold text-ink">{x.title}</span>
                    {x.isKeySession && <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold text-brand">Séance clé</span>}
                  </span>
                  <span className="block text-sm text-ink-soft first-letter:uppercase">{plannedDay(x.date)}</span>
                </span>
                <Link2 className="size-5 shrink-0 text-ink-mute" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {err && <p role="alert" className="mt-3 text-sm font-medium text-bad">{err}</p>}
      </BottomSheet>
    </>
  );
}
