"use client";
import { applyTest } from "@/app/(app)/plan/test/actions";
import { ApplyToProgram } from "@/components/workout/lafay-test-result";

/** « Appliquer à mon programme » relié à l'action serveur. */
export function TestApply(p: { id: string; b: number; template: string; before: { variant: string | null; sets: number; reps: number } | null; appliedAt: string | null }) {
  return <ApplyToProgram b={p.b} template={p.template} before={p.before} appliedAt={p.appliedAt} onApply={() => applyTest(p.id)} />;
}
