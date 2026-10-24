"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Link2, Unlink } from "lucide-react";
import { adoptWatchTime, linkRaceActivity, unlinkRaceActivity } from "@/app/actions";
import { routePath } from "@/lib/polyline";
import { fmtDuration, fmtKm, fmtNum, fmtPace, fmtWhen } from "@/lib/format";
import { fmtHms } from "@/lib/races/format";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";

const TZ = "Europe/Paris";
export type RaceActivityView = { id: string; title: string; type: string; startedAt: string; distanceM: number; movingTimeS: number; elevationGainM: number; avgHr: number | null; polyline: string | null };
export type CandidateView = Pick<RaceActivityView, "id" | "title" | "type" | "startedAt" | "distanceM" | "movingTimeS">;

const btn = "flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface font-semibold disabled:opacity-50";

/** Carte « Ta sortie du jour J » : stats de l'activité liée, temps montre provisoire et délier. */
export function RaceActivityCard({ raceId, activity: a, hasResult }: { raceId: string; activity: RaceActivityView; hasResult: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const pace = fmtPace(a.distanceM, a.movingTimeS, a.type), route = a.polyline ? routePath(a.polyline, 320, 110, 12) : null;
  const cells = [
    { l: "Distance", v: `${fmtKm(a.distanceM)} km` }, { l: "Temps montre", v: fmtHms(a.movingTimeS) },
    pace && { l: pace.label, v: `${pace.value} ${pace.unit}` }, a.elevationGainM > 0 && { l: "D+", v: `${fmtNum(a.elevationGainM, 0)} m` },
    a.avgHr && { l: "FC moyenne", v: `${a.avgHr} bpm` },
  ].filter(Boolean) as { l: string; v: string }[];
  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => start(async () => { const r = await f(); if (!r.ok) setErr(r.error ?? "Action impossible."); else { setErr(null); router.refresh(); } });

  return (
    <section className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h2 className="font-display text-lg font-bold">Ta sortie du jour J</h2>
      <Link href={`/activities/${a.id}`} className="block overflow-hidden rounded-xl border border-line active:bg-surface-2">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <div className="min-w-0">
            <p className="truncate font-semibold">{a.title}</p>
            <p className="text-sm text-ink-soft">{SPORTS[a.type]?.label} · {fmtWhen(new Date(a.startedAt), TZ, { prefixed: true })}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
        </div>
        {route && <svg viewBox="0 0 320 110" className="mt-1 h-24 w-full" role="img" aria-label="Tracé de la sortie"><path d={route.d} fill="none" stroke="#F24A00" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" /><circle cx={route.end[0]} cy={route.end[1]} r={4.5} fill="#F24A00" /></svg>}
        <dl className="mt-2 grid grid-cols-2 gap-px border-t border-line bg-line">
          {cells.map((c) => <div key={c.l} className="bg-surface px-4 py-2.5"><dt className="text-xs text-ink-soft">{c.l}{c.l === "Temps montre" && !hasResult ? " (provisoire)" : ""}</dt><dd className="font-display text-xl font-bold tabular-nums">{c.v}</dd></div>)}
        </dl>
      </Link>
      {!hasResult && <button disabled={pending} onClick={() => run(() => adoptWatchTime(raceId))} className={cn(btn, "border-transparent bg-brand text-brand-ink")}>{pending ? "Enregistrement…" : `Utiliser ${fmtHms(a.movingTimeS)} comme temps officiel`}</button>}
      {err && <p role="alert" className="text-sm font-semibold">{err}</p>}
      <button disabled={pending} onClick={() => run(() => unlinkRaceActivity(raceId))} className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold text-ink-soft active:bg-surface-2"><Unlink className="h-4 w-4" aria-hidden />Ce n’est pas la bonne sortie : délier</button>
    </section>
  );
}

/** Pas d'activité liée : choix en 1 tap parmi les sorties du jour J, de la veille et du lendemain. */
export function LinkRaceActivity({ raceId, candidates }: { raceId: string; candidates: CandidateView[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const pick = (id: string) => start(async () => { const r = await linkRaceActivity(raceId, id); if (!r.ok) setErr(r.error); else router.refresh(); });
  if (!open) return <button onClick={() => setOpen(true)} className={btn}><Link2 className="h-4 w-4" aria-hidden />Lier une activité</button>;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-lg font-bold">Quelle sortie ?</h2><button onClick={() => setOpen(false)} className="min-h-11 px-2 text-sm font-semibold text-ink-soft">Fermer</button></div>
      {candidates.length === 0 && <p className="text-sm text-ink-soft">Aucune sortie autour du jour J. Lance une synchro depuis l’onglet Importer.</p>}
      <ul className="space-y-2">
        {candidates.map((c) => {
          const Icon = (SPORTS[c.type] ?? SPORTS.OTHER).icon;
          return (
            <li key={c.id}>
              <button disabled={pending} onClick={() => pick(c.id)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-line px-3 text-left active:bg-surface-2 disabled:opacity-50">
                <Icon className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{c.title}</span>
                  <span className="block text-sm text-ink-soft">{fmtWhen(new Date(c.startedAt), TZ, { short: true })} · {fmtKm(c.distanceM)} km · {fmtDuration(c.movingTimeS)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {err && <p role="alert" className="mt-3 text-sm font-semibold">{err}</p>}
    </section>
  );
}
