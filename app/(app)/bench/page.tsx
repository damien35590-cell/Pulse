import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveProfile } from "@/app/actions";
import { AGE_BANDS, benchRows, recentStats } from "@/lib/bench";
import { fmtNum } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Profils similaires" };
const pace = (p: number) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60) % 60).padStart(2, "0")}`;

export default async function BenchPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const now = new Date();
  const [u, acts] = await Promise.all([
    prisma.user.findUnique({ where: { id: s.user.id }, select: { ageBand: true, sex: true } }),
    prisma.activity.findMany({ where: { userId: s.user.id, startedAt: { gte: new Date(+now - 35 * 864e5) } }, select: { startedAt: true, distanceM: true, movingTimeS: true, elevationGainM: true, type: true } }),
  ]);
  const rows = u?.ageBand && u.sex ? benchRows({ age: u.ageBand, sex: u.sex }, recentStats(acts, now, "Europe/Paris")) : null;
  const sel = "mt-1 min-h-12 w-full rounded-xl border border-line bg-surface px-3 text-base";
  return (
    <div className="space-y-4">
      <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">‹ Accueil</Link>
      <header><h1 className="font-display text-3xl font-bold leading-none">Profils similaires</h1>
        <p className="mt-2 text-sm text-ink-soft">Pulse n’a qu’un utilisateur : toi. La comparaison utilise donc des repères indicatifs par âge et sexe, des ordres de grandeur courants et non une étude. Prends-les comme un cap, pas comme une vérité.</p></header>
      <form action={saveProfile} className="rounded-xl border border-line bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 text-sm text-ink-soft">
          <label>Tranche d’âge<select name="age" defaultValue={u?.ageBand ?? ""} className={sel}><option value="">Choisir</option>{AGE_BANDS.map((a) => <option key={a} value={a}>{a} ans</option>)}</select></label>
          <label>Sexe<select name="sex" defaultValue={u?.sex ?? ""} className={sel}><option value="">Choisir</option><option value="H">Homme</option><option value="F">Femme</option></select></label>
        </div>
        <button className="mt-3 min-h-12 w-full rounded-xl bg-surface-2 font-semibold">Enregistrer</button>
      </form>
      {!rows && <p className="text-sm text-ink-soft">Choisis ton âge et ton sexe pour voir où tu te situes.</p>}
      {rows?.map((r) => {
        const fmt = (v: number) => (r.low ? pace(v) : fmtNum(v));
        return (
          <section key={r.label} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-baseline justify-between gap-2"><h2 className="font-bold">{r.label}</h2><p className="font-display text-xl font-bold tabular-nums">{fmt(r.value)} <span className="text-sm font-medium text-ink-soft">{r.unit}</span></p></div>
            <div className="relative my-4 h-2.5 rounded-full bg-surface-2"><span className="absolute -bottom-1 -top-1 left-1/2 w-0.5 bg-ink-soft" /><span className="absolute -top-[3px] h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-surface bg-brand" style={{ left: `${Math.max(3, Math.min(97, r.pct))}%` }} /></div>
            <p className="text-sm text-ink-soft">Tu devances environ <b className="text-ink">{r.pct} %</b> des profils similaires. Repère médian : {fmt(r.median)} {r.unit}.</p>
          </section>
        );
      })}
    </div>
  );
}
