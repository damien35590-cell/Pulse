import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboard } from "@/lib/data/dashboard";
import { fmtDuration, fmtNum } from "@/lib/format";
import { WeekHero } from "@/components/dashboard/week-hero";
import { GoalCard } from "@/components/dashboard/goal-card";
import { InsightCarousel } from "@/components/dashboard/insight-carousel";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { LevelCard } from "@/components/dashboard/level-card";
import { Shortcuts } from "@/components/dashboard/shortcuts";
import { ActivityCard } from "@/components/dashboard/activity-card";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const d = await getDashboard(s.user.id);
  const first = s.user.name?.split(" ")[0];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold leading-none">{first ? `Salut ${first}` : "Cette semaine"}</h1>
        <p className="mt-1 text-sm text-ink-soft">Semaine du {d.range}</p>
      </header>

      <InstallPrompt />

      {d.empty ? (
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-display text-2xl font-semibold">Votre première sortie commence ici</h2>
          <p className="mt-2 text-ink-soft">Enregistrez une activité ou importez vos fichiers Strava et MyWhoosh : Pulse en tirera des anecdotes dès la première.</p>
          <Link href="/record" className="mt-5 grid min-h-14 place-items-center rounded-xl bg-brand font-display text-xl font-semibold text-brand-ink">Enregistrer une sortie</Link>
        </section>
      ) : (
        <>
          <LevelCard n={d.xp.n} xp={d.xp.xp} need={d.xp.need} weekXp={d.weekXp} />
          <WeekHero km={d.km} days={d.days} />
          <div className="grid grid-cols-3 gap-2.5">
            {[[fmtDuration(d.timeS), "temps"], [fmtNum(d.elevation, 0), "D+ en m"], [d.kcal ? fmtNum(d.kcal, 0) : "–", "kcal"]].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-line bg-surface px-3.5 py-3"><p className="font-display text-[28px] font-bold leading-none tabular-nums">{v}</p><p className="mt-1 text-[13px] text-ink-soft">{l}</p></div>
            ))}
          </div>
          <GoalCard km={d.km} goalKm={d.goalKm} streak={d.streak} />
          <Shortcuts ctl={d.fit.ctl} form={d.fit.form} goals={d.goalCount} />
          <InsightCarousel items={d.insights} />
          <section aria-label="Activités récentes" className="space-y-2.5">
            <h2 className="font-display text-xl font-semibold">Activités récentes</h2>
            {d.recent.map((a) => <ActivityCard key={a.id} a={a} />)}
          </section>
        </>
      )}
    </div>
  );
}
