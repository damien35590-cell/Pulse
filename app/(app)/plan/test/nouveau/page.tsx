import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getWarmupDefaults } from "@/lib/workout/library-db";
import { lastLafayTest } from "@/lib/data/lafay-test";
import { LafayTestRun } from "@/components/workout/lafay-test-run";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test de niveau" };

/** Test de niveau Lafay guidé (plein écran) : échauffement, A, B, C, A1, puis la page résultat. */
export default async function NewLafayTestPage() {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login");
  const [warmup, last] = await Promise.all([getWarmupDefaults(uid), lastLafayTest(uid)]);
  return <LafayTestRun warmupDefaults={warmup} prev={last?.result ?? null} />;
}
