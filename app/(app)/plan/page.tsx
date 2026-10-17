import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@/lib/plan";
import { getCurrentVma, getRunProgram } from "@/lib/data/training";
import { PlanForm } from "@/components/plan/plan-form";
import { PlanView } from "@/components/plan/plan-view";
import { RunProgramForm } from "@/components/training/run-program-form";
import { RunProgramView } from "@/components/training/run-program-view";
import { PlanCalendar } from "@/components/calendar/plan-calendar";
import { ChevronRight } from "lucide-react";
import { CatalogUpdateButton } from "@/components/training/exercise-link";
import { autoSyncExerciseCatalog, getExerciseLinkStats } from "@/lib/data/exercises-catalog";
import { EXERCISE_CATALOG } from "@/lib/training/catalog/exercises";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programme" };

export default async function PlanPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  await autoSyncExerciseCatalog();
  const [run, p, ex] = await Promise.all([getRunProgram(userId), prisma.trainingPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }), getExerciseLinkStats(userId)]);
  const vma = run ? null : await getCurrentVma(userId);
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <header><h1 className="font-display text-3xl font-bold leading-none">Programme</h1>
        <p className="mt-2 text-sm text-ink-soft">Ce n’est pas un avis médical : ajustez selon vos sensations.</p></header>
      {run ? <RunProgramView p={run} /> : <RunProgramForm current={vma && { vmaKmh: vma.vmaKmh, label: vma.label, estimated: vma.source === "ESTIMATED" }} />}
      <PlanCalendar userId={userId} />
      <section aria-labelledby="muscu" className="space-y-3 rounded-xl border border-line bg-surface p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Muscu</p>
          <h2 id="muscu" className="mt-1 font-display text-2xl font-bold leading-none">Mes exercices</h2>
          <p className="mt-1.5 text-sm text-ink-soft">{EXERCISE_CATALOG.length} exercices au catalogue, avec leurs échelles de progression au poids du corps.</p>
        </div>
        <Link href="/plan/exercices" className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
          <span className="text-sm">
            {ex.toReview > 0 ? <><b className="font-display text-lg tabular-nums">{ex.toReview}</b> {ex.toReview > 1 ? "noms à vérifier" : "nom à vérifier"} dans ton historique</> : "Historique entièrement rattaché"}
            <span className="block text-xs text-ink-soft">Catalogue, fiches et variantes</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink-soft" aria-hidden />
        </Link>
        <CatalogUpdateButton />
      </section>
      {p && (
        <section aria-label="Ancien programme" className="space-y-4 pt-4">
          <h2 className="font-display text-xl font-bold">Ancien programme</h2>
          <p className="text-sm text-ink-soft">Un plan construit à partir de votre volume des 4 dernières semaines.</p>
          <PlanForm hasPlan />
          <PlanView key={p.id} id={p.id} plan={p.data as unknown as Plan} done={p.done} />
        </section>
      )}
    </div>
  );
}
