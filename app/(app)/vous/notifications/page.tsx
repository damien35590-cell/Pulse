import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPrefs } from "@/lib/notify/prefs";
import { TopBar } from "@/components/layout/top-bar";
import { NotificationSettings } from "@/components/profile/notification-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const prefs = await getPrefs(s.user.id);
  return (
    <>
      <TopBar title="Notifications" back="/vous" backLabel="Vous" />
      <NotificationSettings prefs={prefs} />
    </>
  );
}
