import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { currentDips, getLafayTest } from "@/lib/data/lafay-test";
import { TopBar } from "@/components/layout/top-bar";
import { LevelVerdict, TestResults } from "@/components/workout/lafay-test-result";
import { TestApply } from "@/components/workout/lafay-test-apply";

export const dynamic = "force-dynamic";
export const metadata = { title: "Résultat du test" };

const when = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));

/** Résultat d'un test de niveau : 4 valeurs (écarts au précédent), niveau conseillé, départ du tome 2, « Appliquer à mon programme ». */
export default async function LafayTestResultPage({ params }: { params: { id: string } }) {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login");
  const t = await getLafayTest(uid, params.id);
  if (!t) notFound();
  const dips = t.appliedAt ? null : await currentDips(uid);
  return (
    <>
      <TopBar title="Test de niveau" subtitle={when(t.takenAt)} back="/plan/test" backLabel="Tests" />
      <div className="space-y-3">
        <TestResults result={t.result} prev={t.prev} />
        <LevelVerdict b={t.result.B} />
        <TestApply id={t.id} b={t.result.B} template={t.applied?.template ?? dips?.template ?? "Haut du corps"} before={dips?.target ?? null} appliedAt={t.appliedAt} />
      </div>
    </>
  );
}
