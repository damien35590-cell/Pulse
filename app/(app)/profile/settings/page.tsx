import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getZones } from "@/lib/data/zones";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { ZonesForm } from "@/components/profile/zones-form";
import { ThemePicker } from "@/components/profile/theme-picker";
import { EquipmentSettings } from "@/components/profile/equipment-settings";
import { getEquipment } from "@/lib/workout/library-db";
import { NotificationSettings } from "@/components/profile/notification-settings";
import { getPrefs } from "@/lib/notify/prefs";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { SignOut } from "@/components/profile/sign-out";

export const dynamic = "force-dynamic";
export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const [zones, equipment, notifyPrefs] = await Promise.all([getZones(userId), getEquipment(userId), getPrefs(userId)]);

  return (
    <>
      <TopBar title="Réglages" back="/profile" backLabel="Vous" />
      <div className="space-y-8">
        <ZonesForm zones={zones} />
        <Section title="Affichage"><ThemePicker /></Section>
        <Section title="Musculation"><EquipmentSettings initial={equipment} /></Section>
        <NotificationSettings prefs={notifyPrefs} />
        <Section title="Application">
          <InstallPrompt variant="card" />
          <SignOut />
        </Section>
      </div>
    </>
  );
}
