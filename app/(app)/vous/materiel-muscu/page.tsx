import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEquipment } from "@/lib/workout/library-db";
import { TopBar } from "@/components/layout/top-bar";
import { EquipmentSettings } from "@/components/profile/equipment-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Matériel de muscu" };

export default async function GymEquipmentPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const equipment = await getEquipment(s.user.id);
  return (
    <>
      <TopBar title="Matériel de muscu" back="/vous" backLabel="Vous" />
      <EquipmentSettings initial={equipment} />
    </>
  );
}
