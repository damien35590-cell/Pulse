"use client";
import { saveTest } from "@/app/(app)/plan/test/actions";
import { LafayTestFlow } from "@/components/workout/lafay-test-flow";
import type { WarmupItem } from "@/lib/workout/warmup";
import type { TestResult } from "@/lib/workout/lafay-test";

/** Le test guidé relié à son enregistrement (action serveur) ; la démo de /ui-kit utilise LafayTestFlow seul. */
export function LafayTestRun({ warmupDefaults, prev }: { warmupDefaults: WarmupItem[]; prev: TestResult | null }) {
  return (
    <LafayTestFlow
      warmupDefaults={warmupDefaults}
      prev={prev}
      onSave={async (body) => {
        const r = await saveTest(body).catch(() => ({ ok: false as const, error: "Impossible d’enregistrer le test : vérifie ta connexion, puis réessaie." }));
        if (!r.ok) throw new Error(r.error);
        return r.id;
      }}
    />
  );
}
