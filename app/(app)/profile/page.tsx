import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Flag, Settings, Trophy, Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadBadgeStats } from "@/lib/data/badges";
import { fmtNum } from "@/lib/format";
import { Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { EditProfile } from "@/components/profile/edit-profile";
import { getGear } from "@/lib/data/gear";
import { getRecordsBySport } from "@/lib/data/records";
import { RecordsTabs } from "@/components/profile/records-tabs";
import { prisma } from "@/lib/prisma";
import { level, rank, xpOf } from "@/lib/xp";
import { getCountdown } from "@/lib/races/time";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vous" };
const TZ = "Europe/Paris";

export default async function ProfilePage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const [me, gear, raceRows] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true, email: true } }), getGear(userId), prisma.raceEvent.findMany({ where: { userId, status: "REGISTERED", date: { gte: new Date(Date.now() - 864e5) } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 5 })]);
  const nextRace = raceRows.map((r) => ({ r, c: getCountdown(r) })).find(({ c }) => !c.isPast);
  const activeGear = gear.filter((g) => !g.retiredAt), wornGear = activeGear.filter((g) => g.level === "critical").length;
  const { acts, stats } = await loadBadgeStats(userId, TZ);
  const records = await getRecordsBySport(userId, TZ, acts.map((a) => a.type));
  const lvl = level(acts.reduce((t, a) => t + xpOf(a), 0));
  const st = stats.GLOBAL; // mêmes totaux que les badges, tous sports confondus

  const links = [
    { href: "/gear", Icon: Wrench, title: "Matériel", sub: wornGear ? <span className="font-semibold text-bad">{wornGear} à remplacer</span> : activeGear.length ? `${activeGear.length} suivi${activeGear.length > 1 ? "s" : ""}, usure et entretien` : "Vélos, chaussures, chaîne, cassette…" },
    { href: "/events", Icon: Flag, title: "Mes courses", sub: nextRace ? <><b className="text-brand">{nextRace.c.short}</b> · {nextRace.r.name}</> : "Inscriptions, résultats, compte à rebours" },
    { href: "/profile/badges", Icon: Trophy, title: "Badges et niveau", sub: `Niveau ${lvl.n} · ${rank(lvl.n)}` },
    { href: "/profile/settings", Icon: Settings, title: "Réglages", sub: "Seuils, apparence, notifications…" },
  ];

  return (
    <div className="space-y-6">
      <EditProfile name={me?.name ?? s.user.email?.split("@")[0] ?? "Vous"} image={me?.image ?? null} email={me?.email ?? null} />
      <dl className={cn(ui.card, "grid grid-cols-4 gap-2 p-4")}>
        <Metric label="Km" value={fmtNum(st.km, 0)} />
        <Metric label="Sorties" value={st.count} />
        <Metric label="D+ (m)" value={fmtNum(st.elevation, 0)} />
        <Metric label="Heures" value={fmtNum(st.hours, 0)} />
      </dl>
      <Section title="Records personnels">
        <RecordsTabs data={records} />
      </Section>
      <nav aria-label="Plus" className={cn(ui.card, "divide-y divide-line overflow-hidden")}>
        {links.map(({ href, Icon, title, sub }) => (
          <Link key={href} href={href} className={cn(ui.pressCard, "flex min-h-16 items-center gap-3 px-4 py-3")}>
            <span className="grid size-10 shrink-0 place-items-center rounded-tile bg-surface-2 text-ink-soft"><Icon className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1"><b className="block font-semibold text-ink">{title}</b><span className="block truncate text-sm text-ink-soft">{sub}</span></span>
            <ChevronRight className="size-4 shrink-0 text-ink-mute" aria-hidden />
          </Link>
        ))}
      </nav>
    </div>
  );
}
