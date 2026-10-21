import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHabits, gpsCoverage } from "@/lib/habits/build";
import { TopBar } from "@/components/layout/top-bar";
import { HabitsView } from "@/components/habits/habits-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes habitudes" };

export default async function HabitsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const [run, ride, coverage] = await Promise.all([getHabits(s.user.id, "RUN"), getHabits(s.user.id, "RIDE"), gpsCoverage(s.user.id)]);
  return (
    <>
      <TopBar title="Mes habitudes" back="/itineraires" subtitle="Tes chemins, tes classiques et tes bifurcations" />
      <HabitsView habits={{ RUN: run, RIDE: ride }} coverage={coverage} />
    </>
  );
}
