import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getZones } from "@/lib/data/zones";
import { TopBar } from "@/components/layout/top-bar";
import { ZonesForm } from "@/components/profile/zones-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Seuils" };

export default async function ThresholdsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const zones = await getZones(s.user.id);
  return (
    <>
      <TopBar title="Seuils" back="/vous" backLabel="Vous" />
      <ZonesForm zones={zones} />
    </>
  );
}
