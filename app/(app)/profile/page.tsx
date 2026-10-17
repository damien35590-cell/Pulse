import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Wrench, type LucideIcon } from "lucide-react";
import { auth } from "@/lib/auth";
import { evaluateBadges } from "@/lib/badges";
import { loadBadgeStats } from "@/lib/data/badges";
import { fmtClock, fmtKm, fmtNum } from "@/lib/format";
import { SPORTS } from "@/lib/sports";
import { getZones } from "@/lib/data/zones";
import { ZonesForm } from "@/components/profile/zones-form";
import { BadgeGrid } from "@/components/profile/badge-grid";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SignOut } from "@/components/profile/sign-out";
import { getGear } from "@/lib/data/gear";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vous" };
const TZ = "Europe/Paris";

export default async function ProfilePage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const [zones, gear] = await Promise.all([getZones(userId), getGear(userId)]);
  const activeGear = gear.filter((g) => !g.retiredAt), wornGear = activeGear.filter((g) => g.level === "critical").length;
  const { acts, rec, stats } = await loadBadgeStats(userId, TZ);
  const badges = evaluateBadges(stats);
  const st = stats.GLOBAL; // mêmes totaux que les badges, tous sports confondus
  // Record de distance : le vélotaf à assistance électrique (EBIKE) n'en établit pas.
  const longest = acts.reduce<(typeof acts)[number] | null>((best, a) => (a.type !== "EBIKE" && a.distanceM > 0 && a.distanceM > (best?.distanceM ?? 0) ? a : best), null);

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
        {[[fmtNum(st.km, 0), "km au total"], [String(st.count), "sorties"], [fmtNum(st.elevation, 0), "m de D+"], [fmtNum(st.hours, 0), "heures en mouvement"]].map(([v, l]) => (
          <div key={l} className="rounded-xl border border-line bg-surface px-4 py-3"><dd className="font-display text-3xl font-bold tabular-nums">{v}</dd><dt className="text-[13px] text-ink-soft">{l}</dt></div>
        ))}
      </dl>
      <section><h2 className="mb-2 font-display text-xl font-bold">Records personnels</h2>
        <div className="divide-y divide-line rounded-xl border border-line bg-surface px-4">
          {rows.length ? rows.map(({ label, value, Icon }) => <p key={label} className="flex items-center justify-between py-3"><span>{label}</span><span className="flex items-center gap-2">{Icon && <Icon className="h-5 w-5 text-brand" aria-hidden />}<b className="font-display text-2xl tabular-nums">{value}</b></span></p>) : <p className="py-4 text-ink-soft">Vos records apparaîtront dès qu’une sortie avec trace GPS les établira.</p>}
        </div>
      </section>
      <Link href="/gear" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-surface-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><Wrench className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1"><b className="block font-display text-lg">Matériel</b><span className={wornGear ? "text-sm font-semibold text-red-600 dark:text-red-400" : "text-sm text-ink-soft"}>{wornGear ? `${wornGear} à remplacer` : activeGear.length ? `${activeGear.length} suivi${activeGear.length > 1 ? "s" : ""}, usure et entretien` : "Vélos, chaussures, chaîne, cassette…"}</span></span>
        <ChevronRight className="h-5 w-5 text-ink-soft" aria-hidden />
      </Link>
      <BadgeGrid badges={badges} />
      <ZonesForm zones={zones} />
      <InstallPrompt variant="card" />
      <SignOut />
    </div>
  );
}