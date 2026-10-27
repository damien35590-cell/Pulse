import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRecordsBySport } from "@/lib/data/records";
import { TopBar } from "@/components/layout/top-bar";
import { RecordsTabs } from "@/components/profile/records-tabs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Records personnels" };
const TZ = "Europe/Paris";

export default async function RecordsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const records = await getRecordsBySport(s.user.id, TZ);
  return (
    <>
      <TopBar title="Records personnels" back="/vous" backLabel="Vous" />
      <RecordsTabs data={records} />
    </>
  );
}
