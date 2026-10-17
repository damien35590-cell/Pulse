import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fitnessSeries, zone } from "@/lib/fitness";
import { estimateLoad, LOAD_SOURCE_LABELS, LOAD_SOURCES, type LoadSource } from "@/lib/load";
import { dayKey, shiftDay } from "@/lib/dates";
import { SPORT_ORDER, SPORTS } from "@/lib/sports";
import { FitnessChart } from "@/components/fitness/fitness-chart";

export const dynamic = "force-dynamic";
export const metadata = { title: "Forme physique" };
const TZ = "Europe/Paris";

type Row = { key: string; label: string; load: number };
/** Barres horizontales : part de chaque ligne dans la charge totale de la semaine. */
function Split({ title, rows, total }: { title: string; rows: Row[]; total: number }) {
  return (
    <div>
      <h3 className="mb-1.5 text-sm font-semibold text-ink-soft">{title}</h3>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex justify-between text-sm"><span>{r.label}</span><span className="tabular-nums"><b>{Math.round(r.load)}</b> <span className="text-ink-soft">· {Math.round((r.load / total) * 100)} %</span></span></div>
            <div className="mt-1 h-2 rounded-full bg-surface-2" aria-hidden><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(2, (r.load / total) * 100)}%` }} /></div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function FitnessPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const now = new Date();
  const acts = await prisma.activity.findMany({ where: { userId: s.user.id, startedAt: { gte: new Date(+now - 330 * 864e5) } }, select: { startedAt: true, movingTimeS: true, type: true, load: true, loadSource: true } });
  const all = fitnessSeries(acts, now, TZ), data = all.slice(-90), t = all[all.length - 1], z = zone(t.form), ramp = t.ctl - all[all.length - 8].ctl;

  // D'où vient la charge des 7 derniers jours (aujourd'hui compris) : par sport et par méthode de calcul.
  const from = shiftDay(dayKey(now, TZ), -6), bySport: Record<string, number> = {}, bySource: Record<string, number> = {};
  let week = 0;
  for (const a of acts) {
    if (dayKey(a.startedAt, TZ) < from) continue;
    const l = a.load ?? estimateLoad(a), src = (a.loadSource ?? "estimate") as LoadSource;
    bySport[a.type] = (bySport[a.type] ?? 0) + l; bySource[src] = (bySource[src] ?? 0) + l; week += l;
  }
  const order = (k: string) => { const i = (SPORT_ORDER as readonly string[]).indexOf(k); return i < 0 ? 99 : i; };
  const sportRows: Row[] = Object.entries(bySport).filter(([, l]) => l > 0).sort(([a, x], [b, y]) => y - x || order(a) - order(b)).map(([k, l]) => ({ key: k, label: SPORTS[k]?.label ?? k, load: l }));
  const sourceRows: Row[] = LOAD_SOURCES.filter((k) => (bySource[k] ?? 0) > 0).map((k) => ({ key: k, label: LOAD_SOURCE_LABELS[k], load: bySource[k] }));
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
      <section className="space-y-4 rounded-xl border border-line bg-surface p-4">
        <div className="flex items-baseline justify-between"><h2 className="font-display text-lg font-bold">Charge des 7 derniers jours</h2><p className="font-display text-2xl font-bold tabular-nums">{Math.round(week)}</p></div>
        {week > 0 ? <>
          <Split title="Par sport" rows={sportRows} total={week} />
          <Split title="Par méthode de calcul" rows={sourceRows} total={week} />
          <p className="text-xs leading-5 text-ink-soft"><b className="text-ink">Puissance</b> : capteur et FTP. <b className="text-ink">Cardio</b> : fréquence cardiaque et FC max. <b className="text-ink">Ressenti</b> : effort noté de 1 à 10 × durée. <b className="text-ink">Estimée</b> : durée et sport seulement. Notez l’effort de vos séances pour fiabiliser le score.</p>
        </> : <p className="text-sm text-ink-soft">Aucune séance ces 7 derniers jours.</p>}
      </section>
      <section className="rounded-xl border border-line bg-surface p-4"><h2 className="mb-2 font-display text-lg font-bold">90 derniers jours</h2><FitnessChart data={data} /></section>
      <section className="rounded-xl border border-line bg-surface p-4 text-sm leading-8 text-ink-soft">
        <h2 className="font-display text-lg font-bold text-ink">Zones de forme</h2>
        Au-dessus de +20 : <b className="text-ink">Transition</b><br />+5 à +20 : <b className="text-ink">Frais</b><br />−10 à +5 : <b className="text-ink">Zone neutre</b><br />−30 à −10 : <b className="text-ink">Optimal</b><br />Sous −30 : <b className="text-ink">Risque élevé</b>
      </section>
    </div>
  );
}
