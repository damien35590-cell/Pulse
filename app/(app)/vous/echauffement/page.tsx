import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWarmupDefaults } from "@/lib/workout/library-db";
import { TopBar } from "@/components/layout/top-bar";
import { WarmupSettings } from "@/components/profile/warmup-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Échauffement" };

export default async function WarmupPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const items = await getWarmupDefaults(s.user.id);
  return (
    <>
      <TopBar title="Échauffement" back="/vous" backLabel="Vous" />
      <WarmupSettings initial={items} />
    </>
  );
}
