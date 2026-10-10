import { redirect } from "next/navigation";
import { Footprints, Flag, Mountain, Flame, Clock, Route } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayKey } from "@/lib/dates";
import { BADGES, bestStreakDays } from "@/lib/badges";
import { fmtClock, fmtKm, fmtNum } from "@/lib/format";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SignOut } from "@/components/profile/sign-out";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vous" };
const ICONS = { foot: Footprints, flag: Flag, mountain: Mountain, flame: Flame, clock: Clock, route: Route };
const TZ = "Europe/Paris";

export default async function ProfilePage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const [all, run, dates, records] = await Promise.all([
    prisma.activity.aggregate({ where: { userId }, _count: true, _sum: { distanceM: true, elevationGainM: true, movingTimeS: true }, _max: { distanceM: true } }),
    prisma.activity.aggregate({ where: { userId, type: "RUN" }, _max: { distanceM: true } }),
    prisma.activity.findMany({ where: { userId }, select: { startedAt: true } }),
    prisma.personalRecord.findMany({ where: { userId, type: "RUN" } }),
  ]);
  const st = {
    count: all._count, totalKm: (all._sum.distanceM ?? 0) / 1000, totalElevation: all._sum.elevationGainM ?? 0, hours: (all._sum.movingTimeS ?? 0) / 3600,
    maxKm: (all._max.distanceM ?? 0) / 1000, maxRunKm: (run._max.distanceM ?? 0) / 1000, bestStreakDays: bestStreakDays(dates.map((d) => dayKey(d.startedAt, TZ))),
  };
  const rec = Object.fromEntries(records.map((r) => [r.kind, r.value]));
  const rows = [
    rec.BEST_5K && ["Meilleur 5 km", fmtClock(rec.BEST_5K)], rec.BEST_10K && ["Meilleur 10 km", fmtClock(rec.BEST_10K)],
    st.maxKm > 0 && ["Plus longue sortie", `${fmtKm(all._max.distanceM ?? 0)} km`],
  ].filter(Boolean) as [string, string][];
  const got = BADGES.filter((b) => b.test(st));

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-brand font-display text-3xl font-bold text-brand-ink">{(s.user.name ?? s.user.email ?? "P")[0].toUpperCase()}</span>
        <div className="min-w-0"><h1 className="truncate font-display text-3xl font-bold leading-none">{s.user.name ?? "Vous"}</h1><p className="truncate text-sm text-ink-soft">{s.user.email}</p></div>
      </header>
      <dl className="grid grid-cols-2 gap-2.5">
        {[[fmtNum(st.totalKm, 0), "km au total"], [String(st.count), "sorties"], [fmtNum(st.totalElevation, 0), "m de D+"], [fmtNum(st.hours, 0), "heures en mouvement"]].map(([v, l]) => (
          <div key={l} className="rounded-xl border border-line bg-surface px-4 py-3"><dd className="font-display text-3xl font-bold tabular-nums">{v}</dd><dt className="text-[13px] text-ink-soft">{l}</dt></div>
        ))}
      </dl>
      <section><h2 className="mb-2 font-display text-xl font-bold">Records personnels</h2>
        <div className="divide-y divide-line rounded-xl border border-line bg-surface px-4">
          {rows.length ? rows.map(([l, v]) => <p key={l} className="flex items-baseline justify-between py-3"><span>{l}</span><b className="font-display text-2xl tabular-nums">{v}</b></p>) : <p className="py-4 text-ink-soft">Vos records apparaîtront dès qu’une sortie avec trace GPS les établira.</p>}
        </div>
      </section>
      <section><h2 className="mb-2 font-display text-xl font-bold">Badges <span className="font-medium text-ink-soft">({got.length}/{BADGES.length})</span></h2>
        <ul className="grid grid-cols-3 gap-2.5">
          {BADGES.map((b) => { const on = got.includes(b), I = ICONS[b.icon]; return (
            <li key={b.id} className={`rounded-xl border border-line bg-surface p-3 text-center ${on ? "" : "opacity-45"}`}>
              <span className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${on ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-soft"}`}><I className="h-6 w-6" aria-hidden /></span>
              <p className="mt-2 text-[13px] font-bold leading-tight">{b.name}</p><p className="mt-0.5 text-[11px] leading-tight text-ink-soft">{b.desc}</p>
            </li>); })}
        </ul>
      </section>
      <InstallPrompt variant="card" />
      <SignOut />
    </div>
  );
}
