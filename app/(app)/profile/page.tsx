import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildBadgeStats, evaluateBadges } from "@/lib/badges";
import { fmtClock, fmtKm, fmtNum } from "@/lib/format";
import { SPORTS } from "@/lib/sports";
import { getZones } from "@/lib/data/zones";
import { ZonesForm } from "@/components/profile/zones-form";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SignOut } from "@/components/profile/sign-out";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vous" };
const TZ = "Europe/Paris";

export default async function ProfilePage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const zones = await getZones(userId);
  const [all, acts, exercises, records, longest, noted] = await Promise.all([
    prisma.activity.aggregate({ where: { userId }, _count: true, _sum: { distanceM: true, elevationGainM: true, movingTimeS: true } }),
    prisma.activity.findMany({
      where: { userId },
      select: { type: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, avgPower: true, maxPower: true, weather: true, feeling: true },
    }),
    prisma.workoutExercise.findMany({ where: { activity: { userId } }, select: { activityId: true, name: true, sets: true, reps: true, loadKg: true } }),
    prisma.personalRecord.findMany({ where: { userId, type: "RUN" } }),
    prisma.activity.findFirst({ where: { userId, distanceM: { gt: 0 } }, orderBy: { distanceM: "desc" }, select: { type: true, distanceM: true } }),
    prisma.activity.count({ where: { userId, AND: [{ notes: { not: null } }, { notes: { not: "" } }] } }),
  ]);
  const st = {
    count: all._count,
    totalKm: (all._sum.distanceM ?? 0) / 1000,
    totalElevation: all._sum.elevationGainM ?? 0,
    hours: (all._sum.movingTimeS ?? 0) / 3600,
  };

  const rec = Object.fromEntries(records.map((r) => [r.kind, r.value]));
  const badges = evaluateBadges(buildBadgeStats(acts, exercises, TZ, { noted, best5kSec: rec.BEST_5K ?? null }));

  type Row = { label: string; value: string; Icon?: LucideIcon };
  const rows: Row[] = [
    rec.BEST_5K && { label: "Meilleur 5 km", value: fmtClock(rec.BEST_5K) },
    rec.BEST_10K && { label: "Meilleur 10 km", value: fmtClock(rec.BEST_10K) },
    // L'icône suit le sport du record : <Bike /> pour le vélo, <Footprints /> pour la course, <Mountain /> pour la rando…
    longest && { label: "Plus longue sortie", value: `${fmtKm(longest.distanceM)} km`, Icon: (SPORTS[longest.type] ?? SPORTS.OTHER).icon },
  ].filter(Boolean) as Row[];

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
          {rows.length ? rows.map(({ label, value, Icon }) => <p key={label} className="flex items-center justify-between py-3"><span>{label}</span><span className="flex items-center gap-2">{Icon && <Icon className="h-5 w-5 text-brand" aria-hidden />}<b className="font-display text-2xl tabular-nums">{value}</b></span></p>) : <p className="py-4 text-ink-soft">Vos records apparaîtront dès qu’une sortie avec trace GPS les établira.</p>}
        </div>
      </section>
      <BadgeGrid badges={badges} />
      <ZonesForm zones={zones} />
      <InstallPrompt variant="card" />
      <SignOut />
    </div>
  );
}