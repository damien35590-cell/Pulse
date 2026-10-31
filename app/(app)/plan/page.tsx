import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { dayKey, shiftDay } from "@/lib/dates";
import { getCoverGoal, getCurrentVma, getRunProgram } from "@/lib/data/training";
import { getStrengthProgram } from "@/lib/data/strength-program";
import { lastLafayTest } from "@/lib/data/lafay-test";
import { autoSyncExerciseCatalog, getExerciseLinkStats } from "@/lib/data/exercises-catalog";
import { EXERCISE_CATALOG } from "@/lib/training/catalog/exercises";
import { PlanCalendar } from "@/components/calendar/plan-calendar";
import { MuscuPanel } from "@/components/programme/muscu-panel";
import { ProgrammeScreen, type Tab } from "@/components/programme/programme-screen";
import { RunEmpty, RunPanel } from "@/components/programme/run-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programme" };

export default async function PlanPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  await autoSyncExerciseCatalog();
  const [run, gym, ex, goal, lastTest] = await Promise.all([getRunProgram(userId), getStrengthProgram(userId), getExerciseLinkStats(userId), getCoverGoal(userId), lastLafayTest(userId)]);
  const vma = run ? null : await getCurrentVma(userId);

  // Onglet par défaut : celui dont la prochaine séance arrive en premier. Running : la date suggérée de la prochaine séance (programme actif) ;
  // Muscu : deux jours après la dernière séance (alternance 2 à 3 par semaine). Jamais avant aujourd'hui ; à égalité, Running.
  const today = dayKey(new Date(), "Europe/Paris");
  const when = (d: string | null) => (d && d > today ? d : d ? today : null);
  const runAt = run?.status === "ACTIVE" && run.next ? when(run.next.date) : null;
  const gymAt = gym.hasHistory && gym.lastDay ? when(shiftDay(gym.lastDay, 2)) : null;
  const defaultTab: Tab = gymAt && (!runAt || gymAt < runAt) ? "gym" : "run";

  const calendar = <PlanCalendar userId={userId} />;
  return (
    <ProgrammeScreen
      defaultTab={defaultTab}
      menu={run && { programId: run.id, paused: run.status === "PAUSED", vma: { vmaKmh: run.vma.vmaKmh, label: run.vma.label } }}
      run={run
        ? <RunPanel p={run} goal={goal} calendar={calendar} />
        : <RunEmpty vma={vma && { vmaKmh: vma.vmaKmh, label: vma.label, estimated: vma.source === "ESTIMATED" }} calendar={calendar} />}
      gym={<MuscuPanel v={gym} exercises={{ total: EXERCISE_CATALOG.length, toReview: ex.toReview }} lastTest={lastTest} />}
    />
  );
}
