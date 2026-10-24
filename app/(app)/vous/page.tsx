import { redirect } from "next/navigation";
import { Dumbbell, Flag, Gauge, Trophy, Wrench } from "lucide-react";
import { auth } from "@/lib/auth";
import { loadBadgeStats } from "@/lib/data/badges";
import { fmtNum } from "@/lib/format";
import { Metric } from "@/components/ui/metric";
import { Section } from "@/components/ui/section";
import { SettingsRow } from "@/components/ui/settings-row";
import { EditProfile } from "@/components/profile/edit-profile";
import { RecordsTabs } from "@/components/profile/records-tabs";
import { NotificationsRow } from "@/components/profile/notifications-row";
import { ThemePicker } from "@/components/profile/theme-picker";
import { InstallRow } from "@/components/profile/install-row";
import { SignOut } from "@/components/profile/sign-out";
import { getGear } from "@/lib/data/gear";
import { getRecordsBySport } from "@/lib/data/records";
import { getZones } from "@/lib/data/zones";
import { thresholdLabel } from "@/lib/zones";
import { getEquipment } from "@/lib/workout/library-db";
import { EQUIPMENT_LABELS } from "@/lib/workout/catalog";
import { getPrefs } from "@/lib/notify/prefs";
import { prisma } from "@/lib/prisma";
import { level, rank, xpOf } from "@/lib/xp";
import { getCountdown } from "@/lib/races/time";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vous" };
const TZ = "Europe/Paris";
const RECORDS_SHOWN = 3;
const card = cn(ui.card, "divide-y divide-surface-2 overflow-hidden");
// Chiffre au-dessus, libellé dessous (Metric met le libellé en tête : on inverse l'ordre).
const stat = "flex flex-col-reverse items-center text-center [&>dt]:mt-1";

export default async function ProfilePage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const [me, gear, raceRows, zones, equipment, notifyPrefs] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true, email: true } }),
    getGear(userId),
    prisma.raceEvent.findMany({ where: { userId, status: "REGISTERED", date: { gte: new Date(Date.now() - 864e5) } }, orderBy: [{ date: "asc" }, { startTime: "asc" }], take: 5 }),
    getZones(userId), getEquipment(userId), getPrefs(userId),
  ]);
  const nextRace = raceRows.map((r) => ({ r, c: getCountdown(r) })).find(({ c }) => !c.isPast);
  const activeGear = gear.filter((g) => !g.retiredAt), wornGear = activeGear.filter((g) => g.level === "critical").length;
  const { acts, stats } = await loadBadgeStats(userId, TZ);
  const records = await getRecordsBySport(userId, TZ, acts.map((a) => a.type));
  const lvl = level(acts.reduce((t, a) => t + xpOf(a), 0));
  const st = stats.GLOBAL; // mêmes totaux que les badges, tous sports confondus

  const seuils = `${thresholdLabel("FTP", zones.ftp, "W", zones.ftpManual)} · ${thresholdLabel("FC max", zones.hrMax, "bpm", zones.hrManual)}`;

  return (
    <div className="space-y-6">
      <EditProfile name={me?.name ?? s.user.email?.split("@")[0] ?? "Vous"} image={me?.image ?? null} email={me?.email ?? null} />

      <dl className={cn(ui.card, "grid grid-cols-4 gap-2 p-4")}>
        <Metric className={stat} align="center" label="km" value={fmtNum(st.km, 0)} />
        <Metric className={stat} align="center" label="sorties" value={st.count} />
        <Metric className={stat} align="center" label="m D+" value={fmtNum(st.elevation, 0)} />
        <Metric className={stat} align="center" label="h" value={fmtNum(st.hours, 0)} />
      </dl>

      <Section title="Records personnels">
        <RecordsTabs data={records} limit={RECORDS_SHOWN} moreHref="/vous/records" />
      </Section>

      <Section title="Mon sport">
        <nav aria-label="Mon sport" className={card}>
          <SettingsRow icon={<Flag aria-hidden />} title="Mes courses" href="/events" value={nextRace ? <><b className="font-semibold text-brand">{nextRace.c.short}</b> · {nextRace.r.name}</> : "Inscriptions, résultats, compte à rebours"} />
          <SettingsRow icon={<Trophy aria-hidden />} title="Badges et niveau" href="/vous/badges" value={`Niveau ${lvl.n} · ${rank(lvl.n)}`} />
          <SettingsRow icon={<Gauge aria-hidden />} title="Seuils" href="/vous/seuils" value={seuils} />
          <SettingsRow icon={<Wrench aria-hidden />} title="Équipement" href="/gear" value={wornGear ? <span className="font-semibold text-bad">{wornGear} à remplacer</span> : activeGear.length ? `${activeGear.length} suivi${activeGear.length > 1 ? "s" : ""}` : "Vélos, chaussures…"} />
        </nav>
      </Section>

      <Section title="Réglages">
        <div className={card}>
          <SettingsRow icon={<Dumbbell aria-hidden />} title="Matériel de muscu" href="/vous/materiel-muscu" value={`${equipment.filter((e) => e !== "aucun").length} sur ${Object.keys(EQUIPMENT_LABELS).length}`} />
          <NotificationsRow prefs={notifyPrefs} />
          <ThemePicker />
          <InstallRow />
        </div>
      </Section>

      <SignOut />
    </div>
  );
}
