import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fitnessSeries, zone } from "@/lib/fitness";
import { FitnessChart } from "@/components/fitness/fitness-chart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forme physique" };

export default async function FitnessPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const now = new Date();
  const acts = await prisma.activity.findMany({ where: { userId: s.user.id, startedAt: { gte: new Date(+now - 330 * 864e5) } }, select: { startedAt: true, movingTimeS: true, type: true } });
  const all = fitnessSeries(acts, now, "Europe/Paris"), data = all.slice(-90), t = all[all.length - 1], z = zone(t.form), ramp = t.ctl - all[all.length - 8].ctl;
  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <header><h1 className="font-display text-3xl font-bold leading-none">Forme physique</h1>
        <p className="mt-2 text-sm text-ink-soft">Calculée sur votre charge d’entraînement, comme sur intervals.icu : fitness sur 42 jours, fatigue sur 7 jours.</p></header>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-line bg-surface p-4"><p className="text-sm text-ink-soft">Fitness</p><p className="font-display text-4xl font-bold tabular-nums">{Math.round(t.ctl)}</p><p className={`text-xs font-semibold ${ramp >= 0 ? "text-brand" : "text-ink-soft"}`}>{ramp >= 0 ? "+" : ""}{Math.round(ramp)} sur 7 jours</p></div>
        <div className="rounded-xl border border-line bg-surface p-4"><p className="text-sm text-ink-soft">Fatigue</p><p className="font-display text-4xl font-bold tabular-nums">{Math.round(t.atl)}</p></div>
      </div>
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex items-end justify-between"><div><p className="text-sm text-ink-soft">Forme du jour</p><p className="font-display text-5xl font-bold tabular-nums">{t.form > 0 ? "+" : ""}{Math.round(t.form)}</p></div><p className="font-display text-xl font-bold text-brand">{z.label}</p></div>
        <p className="mt-2">{z.tip}</p>
        {ramp > 8 && <p className="mt-2 text-sm text-ink-soft">Votre fitness monte vite (+{Math.round(ramp)} en 7 jours) : pensez à une semaine plus légère.</p>}
      </section>
      <section className="rounded-xl border border-line bg-surface p-4"><h2 className="mb-2 font-display text-lg font-bold">90 derniers jours</h2><FitnessChart data={data} /></section>
      <section className="rounded-xl border border-line bg-surface p-4 text-sm leading-8 text-ink-soft">
        <h2 className="font-display text-lg font-bold text-ink">Zones de forme</h2>
        Au-dessus de +20 : <b className="text-ink">Transition</b><br />+5 à +20 : <b className="text-ink">Frais</b><br />−10 à +5 : <b className="text-ink">Zone neutre</b><br />−30 à −10 : <b className="text-ink">Optimal</b><br />Sous −30 : <b className="text-ink">Risque élevé</b>
      </section>
    </div>
  );
}
