import Link from "next/link";
import { redirect } from "next/navigation";
import { Play } from "lucide-react";
import { auth } from "@/lib/auth";
import { listLafayTests } from "@/lib/data/lafay-test";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { TestHistory } from "@/components/workout/lafay-test-result";
import { TEST_INSTRUCTION, TEST_REST_S } from "@/lib/workout/lafay-test";
import { ui } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test de niveau" };

/** Programme › Muscu › Test de niveau : lancer un test, et l'historique des tests (date + 4 valeurs). */
export default async function LafayTestsPage() {
  const uid = (await auth())?.user?.id;
  if (!uid) redirect("/login");
  const tests = await listLafayTests(uid);
  return (
    <>
      <TopBar title="Test de niveau" back="/plan" backLabel="Programme" />
      <div className="space-y-6">
        <section className={cn(ui.card, "space-y-3 p-4")}>
          <p className="text-sm text-ink-soft">
            A (pompes), B (dips), C (tractions supination), puis A1 : {TEST_INSTRUCTION.toLowerCase()}, {TEST_REST_S / 60} min de repos entre chaque.
            Le résultat à B donne le niveau Lafay de départ (tome 1 p. 39). Ce n’est pas une séance : rien n’entre dans ta progression ni tes totaux.
          </p>
          <Link href="/plan/test/nouveau" className={cn(ui.btnPrimary, "w-full")}><Play className="size-5" fill="currentColor" aria-hidden />Faire le test de niveau</Link>
        </section>
        <Section title="Historique">
          <TestHistory tests={tests} />
        </Section>
      </div>
    </>
  );
}
