import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addGoal, deleteGoal } from "@/app/actions";
import { goalProgress, METRICS, PERIODS, type Metric, type Period } from "@/lib/goals";
import { SPORTS, MY_SPORTS } from "@/lib/sports";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Objectifs" };
const sel = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";

export default async function GoalsPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const now = new Date();
  const [goals, acts] = await Promise.all([
    prisma.goal.findMany({ where: { userId: s.user.id, active: true }, orderBy: { createdAt: "asc" } }),
    prisma.activity.findMany({ where: { userId: s.user.id, startedAt: { gte: new Date(+now - 400 * 864e5) } }, select: { startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, type: true } }),
  ]);
  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <h1 className="font-display text-3xl font-bold leading-none">Objectifs</h1>
      {goals.length === 0 && <p className="rounded-xl border border-line bg-surface p-4 text-ink-soft">Aucun objectif pour l’instant. Ajoutez-en un ci-dessous.</p>}
      {goals.map((g) => {
        const m = METRICS[g.metric as Metric], p = goalProgress({ metric: g.metric as Metric, period: g.period as Period, target: g.target, type: g.type }, acts, now, "Europe/Paris"), u = m.unit;
        return (
          <section key={g.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2"><h2 className="font-bold">{m.label}, {g.type ? SPORTS[g.type].label.toLowerCase() : "tous sports"}, {PERIODS[g.period as Period]}</h2>
              <form action={deleteGoal.bind(null, g.id)}><button className="min-h-11 px-2 text-sm text-ink-soft">Retirer</button></form></div>
            <div className="mt-1 flex items-baseline justify-between"><p className="font-display text-3xl font-bold tabular-nums">{fmtNum(p.value)} <span className="text-base font-medium text-ink-soft">/ {fmtNum(p.target, 0)} {u}</span></p><p className="font-display text-2xl font-bold">{Math.round(p.pct)} %</p></div>
            <div className="relative my-3 h-2.5 rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(p.pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${p.pct}%` }} /><span className="absolute -bottom-1 -top-1 w-0.5 bg-ink-soft" style={{ left: `${Math.min(100, p.elapsed * 100)}%` }} />
            </div>
            <p className="text-sm text-ink-soft">Le trait gris est le rythme à tenir. {p.done ? "Objectif atteint." : p.onTrack ? <>À ce rythme, vous finissez à <b className="text-ink">{fmtNum(p.projected)} {u}</b> : sur la bonne voie.</> : <>À ce rythme : {fmtNum(p.projected)} {u}. Il reste {fmtNum(p.target - p.value)} {u}.</>}</p>
          </section>
        );
      })}
      <form action={addGoal} className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Nouvel objectif</h2>
        <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
          <label>Mesure<select name="metric" className={sel}>{Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label>Sport<select name="type" className={sel}><option value="">Tous sports</option>{MY_SPORTS.map((k) => <option key={k} value={k}>{SPORTS[k].label}</option>)}</select></label>
          <label>Période<select name="period" className={sel}>{Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Cible (km, h, m ou séances)<input name="target" required inputMode="decimal" placeholder="0" className={sel} /></label>
        </div>
        <button className="mt-4 min-h-14 w-full rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink">Ajouter l’objectif</button>
      </form>
    </div>
  );
}
