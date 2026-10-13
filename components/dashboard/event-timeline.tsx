import Link from "next/link";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";

export type EventView = { id: string; name: string; date: Date; sport: string; targetDistance: number | null; targetElevation: number | null; days: number; longestKm: number; dPlus: number; distancePct: number | null; elevationPct: number | null };

function Ring({ pct, title, sub }: { pct: number | null; title: string; sub: string }) {
  const r = 30, c = 2 * Math.PI * r, real = pct ?? 0, over = real >= 100;
  return (
    <div className="flex flex-1 flex-col items-center text-center">
      <div className="relative h-[76px] w-[76px]">
        <svg viewBox="0 0 76 76" className="-rotate-90" aria-hidden><circle cx="38" cy="38" r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="8" /><circle cx="38" cy="38" r={r} fill="none" stroke={over ? "#22C55E" : "rgb(var(--brand))"} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, real) / 100)} /></svg>
        <span className="absolute inset-0 grid place-items-center font-display text-lg font-bold tabular-nums">{pct == null ? "–" : `${Math.round(real)} %`}</span>
      </div>
      <p className="mt-1 text-[13px] font-semibold leading-tight">{title}</p>
      <p className="text-[11px] leading-tight text-ink-soft">{sub}</p>
    </div>
  );
}
const fmtDay = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const jx = (n: number) => (n === 0 ? "Jour J" : `J-${n}`);

export function EventTimeline({ events }: { events: EventView[] }) {
  const [next, ...others] = events;
  return (
    <section aria-label="Prochaines échéances">
      <div className="mb-3 flex items-baseline justify-between"><h2 className="font-display text-xl font-bold">Prochaines échéances</h2><Link href="/events" className="text-sm font-semibold text-brand">Gérer</Link></div>
      {!next ? (
        <Link href="/events" className="block rounded-xl border border-dashed border-line bg-surface p-4 text-ink-soft">Aucune échéance. <b className="text-brand">Ajoutez une course</b> pour suivre votre préparation.</Link>
      ) : (
        <div className="space-y-2.5">
          <article className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="truncate text-lg font-bold leading-tight">{next.name}</p><p className="text-sm capitalize text-ink-soft">{fmtDay(next.date)}</p><p className="text-sm text-ink-soft">{SPORTS[next.sport]?.label}{next.targetDistance ? `, ${next.targetDistance} km` : ""}{next.targetElevation ? `, ${next.targetElevation} m D+` : ""}</p></div>
              <p className="font-display text-4xl font-bold leading-none text-brand">{jx(next.days)}</p>
            </div>
            <div className="mt-4 flex gap-3">
              <Ring pct={next.distancePct} title="Distance" sub={next.targetDistance ? `plus longue sortie 28 j : ${next.longestKm.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} / ${next.targetDistance} km` : "distance non renseignée"} />
              <Ring pct={next.elevationPct} title="Dénivelé" sub={next.targetElevation ? `D+ cumulé 28 j : ${Math.round(next.dPlus)} / ${next.targetElevation} m` : "D+ non renseigné"} />
            </div>
          </article>
          {others.length > 0 && (
            <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4">
              {others.map((e) => <li key={e.id} className={cn("w-40 shrink-0 rounded-xl border border-line bg-surface p-3")}><p className="font-display text-2xl font-bold text-brand">{jx(e.days)}</p><p className="truncate font-semibold">{e.name}</p><p className="text-xs capitalize text-ink-soft">{fmtDay(e.date)}</p></li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
