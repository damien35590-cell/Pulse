import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { autoSyncExerciseCatalog, canUseExercise } from "@/lib/data/exercises-catalog";
import { EQUIPMENT_LABELS, ladderOf, LOAD_TYPE_LABELS, MUSCLE_LABELS } from "@/lib/training/catalog/exercises";
import type { SetDetailV2 } from "@/types/training";
import { describe } from "@/lib/progression";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SetsLine } from "@/components/workout/hard-mark";

export const dynamic = "force-dynamic";

const TZ = "Europe/Paris";
const fmtDate = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(d);

/** « 10 · 10 · 8 à 60 kg » d'après le réel série par série (point `warn` après une série marquée « Dur »), sinon le prévu « 3 × 10 à 60 kg ». */
function performed(r: { sets: number; reps: number; loadKg: number | null; setsDetail: unknown }) {
  const d = Array.isArray(r.setsDetail) ? (r.setsDetail as SetDetailV2[]).filter((s) => !s.isWarmup) : [];
  if (!d.length) return describe(r);
  const loads = [...new Set(d.map((s) => s.loadKg).filter((l): l is number => l != null))];
  const rep = (s: SetDetailV2) => `${s.done === false ? "✗" : ""}${s.durationS ? `${s.durationS} s` : s.reps}`;
  if (loads.length > 1) return <SetsLine items={d.map((s) => ({ text: `${rep(s)}${s.loadKg != null ? ` × ${fmtNum(s.loadKg)}` : ""}`, hard: s.hard }))} suffix=" kg" />;
  return <SetsLine items={d.map((s) => ({ text: rep(s), hard: s.hard }))} suffix={loads.length ? ` à ${fmtNum(loads[0])} kg` : ""} />;
}
const bestLoad = (r: { loadKg: number | null; setsDetail: unknown }) =>
  Math.max(r.loadKg ?? 0, ...(Array.isArray(r.setsDetail) ? (r.setsDetail as SetDetailV2[]).filter((s) => s.done !== false && !s.isWarmup).map((s) => s.loadKg ?? 0) : []));

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const e = await prisma.exercise.findUnique({ where: { slug: params.slug }, select: { name: true } });
  return { title: e?.name ?? "Exercice" };
}

export default async function ExercisePage({ params }: { params: { slug: string } }) {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const userId = s.user.id;
  await autoSyncExerciseCatalog();
  const ex = await prisma.exercise.findUnique({ where: { slug: params.slug } });
  if (!ex || (ex.isCustom && !(await canUseExercise(userId, ex.id)))) notFound();

  // Échelle des variantes (catalogue) et ce que j'en ai déjà pratiqué.
  const ladder = ex.isCustom ? [] : ladderOf(ex.slug);
  const ladderRows = ladder.length > 1 ? await prisma.exercise.findMany({ where: { slug: { in: ladder.map((l) => l.slug) }, isCustom: false }, select: { id: true, slug: true } }) : [];
  const ids = [ex.id, ...ladderRows.map((r) => r.id).filter((id) => id !== ex.id)];
  const rows = await prisma.workoutExercise.findMany({
    where: { exerciseId: { in: ids }, activity: { userId } },
    orderBy: [{ activity: { startedAt: "desc" } }, { position: "asc" }],
    take: 300,
    select: { id: true, name: true, sets: true, reps: true, loadKg: true, setsDetail: true, exerciseId: true, activity: { select: { id: true, startedAt: true } } },
  });
  const slugOf = new Map(ladderRows.map((r) => [r.id, r.slug]));
  const practiced = new Map<string, { n: number; last: Date }>();
  for (const r of rows) {
    const slug = slugOf.get(r.exerciseId!) ?? ex.slug, p = practiced.get(slug);
    if (p) p.n++; else practiced.set(slug, { n: 1, last: r.activity.startedAt });
  }
  // Variante actuelle : la plus récemment pratiquée de l'échelle (à égalité, la plus dure).
  const current = ladder.filter((l) => practiced.has(l.slug))
    .sort((a, b) => +practiced.get(b.slug)!.last - +practiced.get(a.slug)!.last || (b.difficulty ?? 0) - (a.difficulty ?? 0))[0]?.slug;

  const mine = rows.filter((r) => r.exerciseId === ex.id);
  const best = mine.length ? Math.max(...mine.map(bestLoad)) : 0;
  const maxReps = mine.length ? Math.max(...mine.map((r) => r.reps)) : 0;
  const stats = [
    { label: "Séances", value: String(new Set(mine.map((r) => r.activity.id)).size) },
    { label: "Dernière fois", value: mine[0] ? fmtDate(mine[0].activity.startedAt) : "—" },
    best > 0 ? { label: "Meilleure charge", value: `${fmtNum(best)} kg` } : { label: "Max de reps", value: maxReps ? String(maxReps) : "—" },
  ];

  return (
    <div className="space-y-5">
      <Link href="/plan/exercices" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Mes exercices</Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{ex.isCustom ? "Exercice perso" : EQUIPMENT_LABELS[ex.equipment]}</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-none">{ex.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full bg-surface-2 px-2.5 py-1">{LOAD_TYPE_LABELS[ex.loadType]}</span>
          {ex.isCustom && <span className="rounded-full bg-surface-2 px-2.5 py-1">{EQUIPMENT_LABELS[ex.equipment]}</span>}
          {ex.difficulty && <span className="rounded-full bg-brand/15 px-2.5 py-1 text-brand">Difficulté {ex.difficulty}/10</span>}
          {ex.mechanic && <span className="rounded-full bg-surface-2 px-2.5 py-1">{ex.mechanic === "COMPOUND" ? "Polyarticulaire" : "Isolation"}</span>}
        </div>
      </header>

      {ex.instructions && (
        <section aria-labelledby="consigne" className="rounded-xl border border-line bg-surface p-4">
          <h2 id="consigne" className="text-xs font-semibold uppercase tracking-wide text-ink-soft">Consigne</h2>
          <p className="mt-1.5 leading-relaxed">{ex.instructions}</p>
        </section>
      )}

      {ex.primaryMuscles.length > 0 && (
        <section aria-labelledby="muscles" className="space-y-2">
          <h2 id="muscles" className="font-display text-xl font-bold">Muscles</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {ex.primaryMuscles.map((m) => <span key={m} className="rounded-full bg-brand px-3 py-1 font-semibold text-brand-ink">{MUSCLE_LABELS[m]}</span>)}
            {ex.secondaryMuscles.map((m) => <span key={m} className="rounded-full border border-line bg-surface px-3 py-1 text-ink-soft">{MUSCLE_LABELS[m]}</span>)}
          </div>
          {ex.secondaryMuscles.length > 0 && <p className="text-xs text-ink-soft">En orange : muscles principaux. Les autres travaillent en soutien.</p>}
        </section>
      )}

      {ladder.length > 1 && (
        <section aria-labelledby="variantes" className="space-y-2">
          <h2 id="variantes" className="font-display text-xl font-bold">Échelle des variantes</h2>
          <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
            {ladder.map((l) => {
              const p = practiced.get(l.slug), here = l.slug === ex.slug, cur = l.slug === current;
              return (
                <li key={l.slug} className={cn(cur && "bg-brand/10")}>
                  <Link href={`/plan/exercices/${l.slug}`} aria-current={here ? "page" : undefined} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold tabular-nums", cur ? "bg-brand text-brand-ink" : p ? "border-2 border-brand text-brand" : "bg-surface-2 text-ink-soft")}>{l.difficulty}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block leading-tight", here ? "font-bold" : "font-semibold")}>{l.name}</span>
                      <span className="text-xs text-ink-soft">
                        {cur ? <b className="text-brand">Ton niveau actuel</b> : p ? "Déjà pratiquée" : "Pas encore pratiquée"}
                        {p && ` · ${p.n} fois, dernière le ${fmtDate(p.last)}`}
                      </span>
                    </span>
                    {here ? <span className="shrink-0 text-xs font-semibold text-ink-soft">Cette fiche</span> : <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section aria-labelledby="historique" className="space-y-2">
        <h2 id="historique" className="font-display text-xl font-bold">Mon historique</h2>
        <dl className="grid grid-cols-3 gap-2">
          {stats.map((st) => <div key={st.label} className="rounded-xl bg-surface-2 px-3 py-2"><dt className="text-xs text-ink-soft">{st.label}</dt><dd className="font-display text-lg font-bold leading-tight tabular-nums">{st.value}</dd></div>)}
        </dl>
        {mine.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {mine.map((r) => (
              <li key={r.id}>
                <Link href={`/activities/${r.activity.id}`} className="flex min-h-12 items-center gap-3 px-3 py-2">
                  <span className="w-24 shrink-0 text-sm text-ink-soft tabular-nums">{fmtDate(r.activity.startedAt)}</span>
                  <span className="min-w-0 flex-1 text-sm font-semibold tabular-nums">{performed(r)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-soft">Aucune séance rattachée à cet exercice pour l’instant.</p>}
      </section>
    </div>
  );
}
