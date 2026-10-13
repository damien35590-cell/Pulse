import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { dayKey, shiftDay, weekKeys } from "@/lib/dates";
import { fillMissingDates, groupByWeek } from "@/lib/fill-dates";
import { climbCompare } from "@/lib/insights/landmarks";
import { SPORTS, MY_SPORTS } from "@/lib/sports";
import { fmtDuration, fmtNum } from "@/lib/format";
import { WeeklyBars, PaceArea } from "@/components/analysis/charts";
import { DisciplineRadar } from "@/components/analysis/discipline-radar";
import { PowerCurveChart } from "@/components/activity/power-curve-chart";
import { AnatomyHeatmap } from "@/components/musculation/anatomy-heatmap";
import { getAdvanced } from "@/lib/data/advanced";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analyse" };
const TZ = "Europe/Paris", DAYS = "LMMJVSD", FULL = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const lab = (k: string) => new Date(k + "T00:00:00Z").toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });
const dow = (k: string) => (new Date(k + "T00:00:00Z").getUTCDay() + 6) % 7;
type Sp = { w?: string; s?: string; a?: string; b?: string };

export default async function AnalysisPage({ searchParams }: { searchParams: Sp }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const now = new Date(), W = [4, 12, 26].includes(Number(searchParams.w)) ? Number(searchParams.w) : 12;
  const S = (MY_SPORTS as readonly string[]).includes(searchParams.s ?? "") ? searchParams.s! : "all";
  const acts = await prisma.activity.findMany({
    where: { userId: session.user.id, startedAt: { gte: new Date(+now - (Math.max(2 * W, 26) * 7 + 14) * 864e5) } }, orderBy: { startedAt: "asc" },
    select: { id: true, type: true, title: true, startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true },
  });
  const adv = await getAdvanced(session.user.id, TZ);
  const mon = weekKeys(now, TZ)[0], today = dayKey(now, TZ);
  const ago = (d: Date) => { const diff = (Date.parse(mon) - Date.parse(dayKey(d, TZ))) / 864e5; return diff <= 0 ? 0 : Math.ceil(diff / 7); };
  const hit = (a: { type: string }) => S === "all" || a.type === S, sum = <T,>(l: T[], f: (x: T) => number) => l.reduce((s, x) => s + f(x), 0);
  const cur = acts.filter((a) => ago(a.startedAt) < W && hit(a)), prev = acts.filter((a) => { const k = ago(a.startedAt); return k >= W && k < 2 * W && hit(a); });
  const kpis = [
    { l: "Distance", c: sum(cur, (a) => a.distanceM) / 1000, p: sum(prev, (a) => a.distanceM) / 1000, f: (v: number) => `${fmtNum(v, 1)} km` },
    { l: "Temps", c: sum(cur, (a) => a.movingTimeS), p: sum(prev, (a) => a.movingTimeS), f: (v: number) => fmtDuration(v) },
    { l: "Dénivelé +", c: sum(cur, (a) => a.elevationGainM), p: sum(prev, (a) => a.elevationGainM), f: (v: number) => `${fmtNum(v, 0)} m` },
    { l: "Sorties", c: cur.length, p: prev.length, f: (v: number) => String(v) },
  ];
  // Jours sans activité injectés à 0 : l'axe X reste continu et proportionnel (aucune semaine ne « disparaît »).
  const daily = fillMissingDates(acts.filter(hit), shiftDay(mon, -7 * (W - 1)), today, TZ);
  const weekly = groupByWeek(daily).map((w) => ({ label: lab(w.weekStart), km: w.distance, time: w.time, dPlus: w.dPlus }));
  const pace = Array.from({ length: W }, (_, i) => { const k = W - 1 - i, r = acts.filter((a) => a.type === "RUN" && a.distanceM >= 2000 && ago(a.startedAt) === k); return r.length ? { label: lab(shiftDay(mon, -7 * k)), pace: sum(r, (a) => a.movingTimeS) / 60 / (sum(r, (a) => a.distanceM) / 1000) } : null; }).filter(Boolean) as { label: string; pace: number }[];
  const inWin = acts.filter((a) => ago(a.startedAt) < W), tt = sum(inWin, (a) => a.movingTimeS) || 1;
  const shares = MY_SPORTS.map((k, i) => ({ k, pct: (sum(inWin.filter((a) => a.type === k), (a) => a.movingTimeS) / tt) * 100, o: [1, 0.7, 0.45, 0.25][i] }));
  let off = 0;
  const cells = new Map<string, number>(); for (const a of acts.filter(hit)) { const k = dayKey(a.startedAt, TZ), key = `${ago(a.startedAt)}-${dow(k)}`; cells.set(key, (cells.get(key) ?? 0) + a.distanceM / 1000 + 0.001); }
  const wd = [0, 1, 2, 3, 4, 5, 6].map((r) => sum(cur.filter((a) => dow(dayKey(a.startedAt, TZ)) === r), (a) => a.distanceM) / 1000 / W), wm = Math.max(...wd, 0.1), fav = Math.max(0, wd.indexOf(wm));
  const best = Math.max(0, ...weekly.map((x) => x.km)), longest = Math.max(0, ...cur.map((a) => a.distanceM)) / 1000, days = new Set(cur.map((a) => dayKey(a.startedAt, TZ))).size;
  const recent = acts.filter(hit).slice(-14).reverse(), A = recent.find((a) => a.id === searchParams.a) ?? recent[0], B = recent.find((a) => a.id === searchParams.b) ?? recent[1];
  const qs = (o: Partial<Sp>) => { const p = new URLSearchParams({ w: String(W), s: S, ...o } as Record<string, string>); return `/analysis?${p}`; };
  const chip = (on: boolean) => `inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium ${on ? "bg-brand text-brand-ink" : "bg-surface-2"}`;
  const card = "rounded-xl border border-line bg-surface p-4", h2 = "mb-2 mt-6 font-display text-xl font-bold";

  return (
    <div>
      <h1 className="font-display text-3xl font-bold leading-none">Analyse</h1>
      <div className="mt-4 flex gap-1 rounded-full bg-surface-2 p-1">{[4, 12, 26].map((n) => <Link key={n} href={qs({ w: String(n) })} className={`flex min-h-10 flex-1 items-center justify-center rounded-full text-sm ${n === W ? "bg-surface font-bold shadow" : "text-ink-soft"}`}>{n} sem.</Link>)}</div>
      <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">{[["all", "Tous"], ...MY_SPORTS.map((k) => [k, SPORTS[k].label])].map(([k, l]) => <Link key={k} href={qs({ s: k })} className={chip(S === k)}>{l}</Link>)}</div>
      <div className="mt-4 grid grid-cols-2 gap-2.5">{kpis.map((k) => { const d = k.p > 0 ? Math.round(((k.c - k.p) / k.p) * 100) : null; return <div key={k.l} className="rounded-xl border border-line bg-surface p-3.5"><p className="text-sm text-ink-soft">{k.l}</p><p className="font-display text-3xl font-bold leading-tight tabular-nums">{k.f(k.c)}</p>{d != null && <p className={`text-xs font-semibold ${d >= 0 ? "text-brand" : "text-ink-soft"}`}>{d > 0 ? "+" : ""}{d} % vs période préc.</p>}</div>; })}</div>

      <h2 className={h2}>Distance par semaine</h2><div className={card}><WeeklyBars data={weekly} /></div>
      <h2 className={h2}>Allure en course</h2><div className={card}>{pace.length > 2 ? <><PaceArea data={pace} /><p className="text-xs text-ink-soft">Plus la courbe monte, plus vous allez vite.</p></> : <p className="text-sm text-ink-soft">Pas assez de courses sur cette période.</p>}</div>

      <h2 className={h2}>Répartition du temps</h2>
      <div className={`${card} flex items-center gap-4`}>
        <svg viewBox="0 0 42 42" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label="Répartition du temps par sport"><circle cx="21" cy="21" r="15.915" fill="none" stroke="rgb(var(--surface-2))" strokeWidth="6" />
          {shares.map((s) => { const o = off; off += s.pct; return s.pct ? <circle key={s.k} cx="21" cy="21" r="15.915" fill="none" stroke="rgb(var(--brand))" strokeOpacity={s.o} strokeWidth={S === s.k ? 7.5 : 6} strokeDasharray={`${s.pct.toFixed(2)} ${(100 - s.pct).toFixed(2)}`} strokeDashoffset={-o.toFixed(2)} /> : null; })}</svg>
        <ul className="flex-1">{shares.map((s) => <li key={s.k}><Link href={qs({ s: S === s.k ? "all" : s.k })} className="flex min-h-11 items-center gap-2.5"><i className="h-3 w-3 rounded-sm bg-brand" style={{ opacity: s.o }} /><span className={`flex-1 ${S === s.k ? "font-bold" : ""}`}>{SPORTS[s.k].label}</span><b className="font-display text-lg tabular-nums">{Math.round(s.pct)} %</b></Link></li>)}</ul>
      </div>

      <h2 className={h2}>Régularité sur 26 semaines</h2>
      <div className={card}><div className="grid grid-flow-col grid-rows-7 gap-[3px]">{Array.from({ length: 26 * 7 }, (_, i) => { const c = 25 - Math.floor(i / 7), r = i % 7, km = cells.get(`${c}-${r}`), future = c === 0 && r > dow(today); return <i key={i} title={km ? `${fmtNum(km, 1)} km` : undefined} className="aspect-square rounded-[3px] bg-brand" style={{ opacity: future ? 0 : km ? Math.min(1, 0.28 + (km || 8) / 28) : 0.07 }} />; })}</div></div>

      <h2 className={h2}>Vos jours de sortie</h2>
      <div className={card}><div className="grid h-24 grid-cols-7 items-end gap-1.5">{wd.map((v, r) => <div key={r} className="flex h-full flex-col items-center justify-end gap-1.5 text-xs text-ink-soft"><b className="w-full rounded-md bg-brand" style={{ height: Math.max(4, (v / wm) * 70), opacity: r === fav ? 1 : 0.4 }} />{DAYS[r]}</div>)}</div>
        <p className="mt-3 text-sm text-ink-soft">{wd[fav] > 0 ? <>Votre jour préféré : <b className="text-ink">{FULL[fav]}</b>, {fmtNum(wd[fav], 1)} km en moyenne.</> : "Pas encore de sorties sur cette période."}</p></div>

      <h2 className={h2}>À retenir</h2>
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line">{[["Meilleure semaine", `${fmtNum(best, 1)} km`], ["Plus longue sortie", `${fmtNum(longest, 1)} km`], ["Dénivelé en repères", climbCompare(sum(cur, (a) => a.elevationGainM), mon)?.short ?? `${fmtNum(sum(cur, (a) => a.elevationGainM), 0)} m`], ["Jours actifs", `${days}/${W * 7}`]].map(([l, v]) => <div key={l} className="bg-surface px-4 py-3"><dt className="text-xs text-ink-soft">{l}</dt><dd className="font-display text-2xl font-bold tabular-nums">{v}</dd></div>)}</dl>

      <h2 className={h2}>Profil par discipline</h2><div className={card}><DisciplineRadar cycling={adv.cycling} running={adv.running} /></div>
      {adv.record.some(Boolean) && (
        <><h2 className={h2}>Courbe de puissance</h2>
          <div className={card}><PowerCurveChart record={adv.record} recent={adv.last30} />
            <p className="mt-1 text-xs text-ink-soft">Meilleure puissance moyenne maintenue sur chaque durée : record absolu (gris) et 30 derniers jours (orange).</p></div></>
      )}
      <h2 className={h2}>Muscles sollicités (7 jours)</h2><div className={card}><AnatomyHeatmap data={adv.muscles} hasData={adv.hasMuscle} /></div>
      {A && B && <>
        <h2 className={h2}>Comparer deux sorties</h2>
        <form className={card} action="/analysis"><input type="hidden" name="w" value={W} /><input type="hidden" name="s" value={S} />
          <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">{(["a", "b"] as const).map((n) => <label key={n}>Sortie {n.toUpperCase()}<select name={n} defaultValue={(n === "a" ? A : B).id} className="mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-2 text-base text-ink">{recent.map((a) => <option key={a.id} value={a.id}>{lab(dayKey(a.startedAt, TZ))}, {SPORTS[a.type].label} {fmtNum(a.distanceM / 1000, 1)} km</option>)}</select></label>)}</div>
          <button className="mt-3 min-h-11 w-full rounded-xl bg-surface-2 font-semibold">Comparer</button>
          <div className="mt-4 grid grid-cols-[80px_1fr] items-center gap-x-3 gap-y-3 text-sm">{[["Distance", A.distanceM / 1000, B.distanceM / 1000, (v: number) => `${fmtNum(v, 1)} km`], ["Durée", A.movingTimeS, B.movingTimeS, fmtDuration], ["Dénivelé +", A.elevationGainM, B.elevationGainM, (v: number) => `${fmtNum(v, 0)} m`]].map(([l, a, b, f]) => { const m = Math.max(a as number, b as number, 0.01), fn = f as (v: number) => string; return <div key={l as string} className="contents"><span className="text-ink-soft">{l as string}</span><div><div className="h-3 rounded-md bg-brand" style={{ width: `${((a as number) / m) * 100}%` }} /><div className="mt-1 h-3 rounded-md bg-ink-soft/50" style={{ width: `${((b as number) / m) * 100}%` }} /><p className="mt-1 font-semibold">{fn(a as number)} / {fn(b as number)}</p></div></div>; })}</div>
          <p className="mt-3 text-xs text-ink-soft">Orange : sortie A. Gris : sortie B.</p></form>
      </>}
    </div>
  );
}
