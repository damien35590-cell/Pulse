import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Plan } from "@/lib/plan";
import { PlanForm } from "@/components/plan/plan-form";
import { PlanView } from "@/components/plan/plan-view";

export const dynamic = "force-dynamic";
export const metadata = { title: "Programme" };

export default async function PlanPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const p = await prisma.trainingPlan.findFirst({ where: { userId: s.user.id }, orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <header><h1 className="font-display text-3xl font-bold leading-none">Programme</h1>
        <p className="mt-2 text-sm text-ink-soft">Un plan construit à partir de votre volume des 4 dernières semaines. Ce n’est pas un avis médical : ajustez selon vos sensations.</p></header>
      <PlanForm hasPlan={!!p} />
      {p && <PlanView key={p.id} id={p.id} plan={p.data as unknown as Plan} done={p.done} />}
    </div>
  );
}
