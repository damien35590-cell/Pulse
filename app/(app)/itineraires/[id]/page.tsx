import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRoute } from "@/lib/data/routes";
import { TopBar } from "@/components/layout/top-bar";
import { RouteDetail } from "@/components/routes/route-detail";
import { sportLine } from "@/lib/routes/view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Boucle" };

export default async function RoutePage({ params }: { params: { id: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const r = await getRoute(s.user.id, params.id);
  if (!r) notFound();

  return (
    <>
      <TopBar title={r.label} back="/itineraires" backLabel="Itinéraires" subtitle={`${sportLine(r)} · ${r.minutes} min visées`} />
      <RouteDetail r={r} />
    </>
  );
}
