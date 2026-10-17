import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoSyncExerciseCatalog, getUnlinkedNames, userExercises } from "@/lib/data/exercises-catalog";
import { BODYWEIGHT_LADDERS, EQUIPMENT_LABELS, EXERCISE_CATALOG } from "@/lib/training/catalog/exercises";
import { CatalogUpdateButton, UnlinkedList } from "@/components/training/exercise-link";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes exercices" };

export default async function ExercisesPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  await autoSyncExerciseCatalog();
  const [unlinked, options, counts] = await Promise.all([
    getUnlinkedNames(userId),
    userExercises(userId),
    prisma.workoutExercise.groupBy({ by: ["exerciseId"], where: { exerciseId: { not: null }, activity: { userId } }, _count: { _all: true } }),
  ]);
  const done = new Map(counts.map((c) => [c.exerciseId!, c._count._all]));
  const bySlug = new Map(options.map((o) => [o.slug, o]));
  const timesOf = (slug: string) => { const o = bySlug.get(slug); return (o && done.get(o.id)) ?? 0; };
  const weights = EXERCISE_CATALOG.filter((e) => e.loadType === "EXTERNAL");
  const custom = options.filter((o) => o.isCustom);

  return (
    <div className="space-y-6">
      <Link href="/plan" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Programme</Link>
      <header><h1 className="font-display text-3xl font-bold leading-none">Mes exercices</h1>
        <p className="mt-2 text-sm text-ink-soft">Relie tes séances au catalogue pour suivre ta progression exercice par exercice.</p></header>

      <section aria-labelledby="a-verifier" className="space-y-3">
        <h2 id="a-verifier" className="font-display text-xl font-bold">À vérifier{unlinked.length > 0 && <span className="ml-2 text-base text-ink-soft tabular-nums">{unlinked.length}</span>}</h2>
        {unlinked.length > 0 ? <>
          <p className="text-sm text-ink-soft">Ces noms ne correspondent à aucun exercice avec certitude. Rattache-les une fois : toutes les séances qui portent ce nom suivent, et les prochaines aussi.</p>
          <UnlinkedList items={unlinked} options={options} />
        </> : <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">Tout ton historique est rattaché 👌</p>}
        <CatalogUpdateButton />
      </section>

      <section aria-labelledby="poids-du-corps" className="space-y-3">
        <h2 id="poids-du-corps" className="font-display text-xl font-bold">Poids du corps</h2>
        <p className="text-sm text-ink-soft">Chaque échelle va de la variante la plus facile à la plus dure (difficulté sur 10).</p>
        <div className="space-y-3">
          {BODYWEIGHT_LADDERS.map((l) => (
            <ol key={l[0].slug} className="divide-y divide-line rounded-xl border border-line bg-surface">
              {l.map((e) => { const n = timesOf(e.slug); return (
                <li key={e.slug}>
                  <Link href={`/plan/exercices/${e.slug}`} className="flex min-h-12 items-center gap-3 px-3 py-2">
                    <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums", n ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink-soft")}>{e.difficulty}</span>
                    <span className="min-w-0 flex-1 font-semibold leading-tight">{e.name}</span>
                    {n > 0 && <span className="shrink-0 text-xs text-ink-soft tabular-nums">{n}×</span>}
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
                  </Link>
                </li>); })}
            </ol>
          ))}
        </div>
      </section>

      <section aria-labelledby="charges" className="space-y-3">
        <h2 id="charges" className="font-display text-xl font-bold">Barre et haltères</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {weights.map((e) => { const n = timesOf(e.slug); return (
            <li key={e.slug}>
              <Link href={`/plan/exercices/${e.slug}`} className="flex min-h-12 items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1"><span className="block font-semibold leading-tight">{e.name}</span><span className="text-xs text-ink-soft">{EQUIPMENT_LABELS[e.equipment]}</span></span>
                {n > 0 && <span className="shrink-0 text-xs text-ink-soft tabular-nums">{n}×</span>}
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
              </Link>
            </li>); })}
        </ul>
      </section>

      {custom.length > 0 && (
        <section aria-labelledby="perso" className="space-y-3">
          <h2 id="perso" className="font-display text-xl font-bold">Mes exercices perso</h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {custom.map((o) => (
              <li key={o.id}>
                <Link href={`/plan/exercices/${o.slug}`} className="flex min-h-12 items-center gap-3 px-3 py-2">
                  <span className="min-w-0 flex-1"><span className="block font-semibold leading-tight">{o.name}</span><span className="text-xs text-ink-soft">{EQUIPMENT_LABELS[o.equipment]}</span></span>
                  <span className="shrink-0 text-xs text-ink-soft tabular-nums">{done.get(o.id) ?? 0}×</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
