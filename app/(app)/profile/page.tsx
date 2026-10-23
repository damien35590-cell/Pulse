import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Flag, Trophy, Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadBadgeStats } from "@/lib/data/badges";
import { fmtNum } from "@/lib/format";
import { getZones } from "@/lib/data/zones";
import { ZonesForm } from "@/components/profile/zones-form";
import { Section } from "@/components/ui/section";
import { ThemePicker } from "@/components/profile/theme-picker";
import { EquipmentSettings } from "@/components/profile/equipment-settings";
import { getEquipment } from "@/lib/workout/library-db";
import { NotificationSettings } from "@/components/profile/notification-settings";
import { getPrefs } from "@/lib/notify/prefs";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { EditProfile } from "@/components/profile/edit-profile";
import { SignOut } from "@/components/profile/sign-out";
import { getGear } from "@/lib/data/gear";
import { getRecordsBySport } from "@/lib/data/records";
import { RecordsTabs } from "@/components/profile/records-tabs";
import { prisma } from "@/lib/prisma";
import { level, rank, xpOf } from "@/lib/xp";
import { getCountdown } from "@/lib/races/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vous" };
const TZ = "Europe/Paris";

export default async function ProfilePage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const [me, zones, gear, notifyPrefs, raceRows] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true, email: true } }), getZones(userId), getGear(userId), getPrefs(userId), prisma.raceEvent.findMany({ where: { userId, status: "REGISTERED", date: { gte: new Date(Date.now() - 864e5) } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 5 })]);
  const nextRace = raceRows.map((r) => ({ r, c: getCountdown(r) })).find(({ c }) => !c.isPast);
  const activeGear = gear.filter((g) => !g.retiredAt), wornGear = activeGear.filter((g) => g.level === "critical").length;
  const { acts, stats } = await loadBadgeStats(userId, TZ);
  const records = await getRecordsBySport(userId, TZ, acts.map((a) => a.type));
  const lvl = level(acts.reduce((t, a) => t + xpOf(a), 0));
  const st = stats.GLOBAL; // mêmes totaux que les badges, tous sports confondus

  return (
    <div className="space-y-6">
      <EditProfile name={me?.name ?? s.user.email?.split("@")[0] ?? "Vous"} image={me?.image ?? null} email={me?.email ?? null} />
      <dl className="grid grid-cols-2 gap-2.5">
        {[[fmtNum(st.km, 0), "km au total"], [String(st.count), "sorties"], [fmtNum(st.elevation, 0), "m de D+"], [fmtNum(st.hours, 0), "heures en mouvement"]].map(([v, l]) => (
          <div key={l} className="rounded-xl border border-line bg-surface px-4 py-3"><dd className="font-display text-3xl font-bold tabular-nums">{v}</dd><dt className="text-[13px] text-ink-soft">{l}</dt></div>
        ))}
      </dl>
      <section><h2 className="mb-2 font-display text-xl font-bold">Records personnels</h2>
        <RecordsTabs data={records} />
      </section>
      <Link href="/gear" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-surface-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><Wrench className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1"><b className="block font-display text-lg">Matériel</b><span className={wornGear ? "text-sm font-semibold text-red-600 dark:text-red-400" : "text-sm text-ink-soft"}>{wornGear ? `${wornGear} à remplacer` : activeGear.length ? `${activeGear.length} suivi${activeGear.length > 1 ? "s" : ""}, usure et entretien` : "Vélos, chaussures, chaîne, cassette…"}</span></span>
        <ChevronRight className="h-5 w-5 text-ink-soft" aria-hidden />
      </Link>
      <Link href="/events" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-surface-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><Flag className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1"><b className="block font-display text-lg">Mes courses</b><span className="text-sm text-ink-soft">{nextRace ? <><b className="text-brand">{nextRace.c.short}</b> · {nextRace.r.name}</> : "Inscriptions, résultats, compte à rebours"}</span></span>
        <ChevronRight className="h-5 w-5 text-ink-soft" aria-hidden />
      </Link>
      <Link href="/profile/badges" className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 active:bg-surface-2">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand/10 text-brand"><Trophy className="h-5 w-5" aria-hidden /></span>
        <span className="min-w-0 flex-1"><b className="block font-display text-lg">Badges et niveau</b><span className="text-sm text-ink-soft">Niveau {lvl.n} · {rank(lvl.n)}</span></span>
        <ChevronRight className="h-5 w-5 text-ink-soft" aria-hidden />
      </Link>
      <ZonesForm zones={zones} />
      <Section title="Réglages"><ThemePicker /><EquipmentSettings initial={await getEquipment(userId)} /></Section>
      <NotificationSettings prefs={notifyPrefs} />
      <InstallPrompt variant="card" />
      <SignOut />
    </div>
  );
}