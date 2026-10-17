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

export const dynamic = "force-dynamic";
export const metadata = { title: "Programme" };

export default async function PlanPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  const [run, p] = await Promise.all([getRunProgram(userId), prisma.trainingPlan.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } })]);
  const vma = run ? null : await getCurrentVma(userId);
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <header><h1 className="font-display text-3xl font-bold leading-none">Programme</h1>
        <p className="mt-2 text-sm text-ink-soft">Ce n’est pas un avis médical : ajustez selon vos sensations.</p></header>
      {run ? <RunProgramView p={run} /> : <RunProgramForm current={vma && { vmaKmh: vma.vmaKmh, label: vma.label, estimated: vma.source === "ESTIMATED" }} />}
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
