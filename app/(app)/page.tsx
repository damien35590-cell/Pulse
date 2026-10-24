import Link from "next/link";
import { Flag, HeartPulse, Upload } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboard } from "@/lib/data/dashboard";
import { gearAlerts } from "@/lib/data/gear";
import { getPendingBadges } from "@/lib/data/badges";
import { getRunProgram } from "@/lib/data/training";
import { fmtRaceDistance } from "@/lib/races/format";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { WeekCard } from "@/components/dashboard/week-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ActivitySummary } from "@/components/dashboard/activity-summary";
import { PendingResultCard } from "@/components/dashboard/pending-result-card";
import { cells } from "@/components/dashboard/activity-card";
import { GearAlert } from "@/components/gear/gear-alert";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ProgramCard, StartProgramCard, cheer } from "@/components/training/program-card";
import { PlanRouteCard } from "@/components/routes/plan-route-card";
import { PendingBadgesCard } from "@/components/profile/pending-badges-card";
import { CoachCard } from "@/components/dashboard/coach-card";
import { getCoach } from "@/lib/coach/load";
import { fmtWhen } from "@/lib/format";

export const dynamic = "force-dynamic";

const TZ = "Europe/Paris";
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
// Muscu : durée, séries, volume. Autres sports : les 3 premiers chiffres de cells().
const LIFT = ["Durée", "Séries", "Volume"];

/**
 * Accueil : la semaine en tête, puis la séance du jour (carte « Aujourd'hui » du coach, seul bouton Volt de l'écran),
 * le programme course, forme + prochaine course, et le récent.
 */
export default async function DashboardPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const [d, worn, run, pendingBadges] = await Promise.all([
    getDashboard(s.user.id), gearAlerts(s.user.id), getRunProgram(s.user.id),
    getPendingBadges(s.user.id).catch((e) => { console.error("[badges] accueil", e); return []; }),
  ]);
  // Le coach ne bloque jamais l'accueil : en cas de souci, la carte n'apparaît pas.
  const coach = await getCoach(s.user.id, run).catch((e) => { console.error("[coach]", e); return null; });
  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date());
  const phrase = run && run.status === "ACTIVE" ? cheer(run.weekDone, run.sessionsPerWeek) : null;
  const goal = d.goals[0];
  const race = d.events[0];
  const recent = d.recent.map((a) => {
    const all = cells(a), picked = a.type === "WORKOUT" ? LIFT.map((l) => all.find((c) => c.l === l)).filter((c) => !!c) : all;
    return {
      id: a.id, type: a.type, title: a.title, story: a.story ?? undefined, tags: a.muscles.length ? a.muscles : undefined,
      when: fmtWhen(a.startedAt, TZ),
      metrics: picked.slice(0, 3).map((c) => ({ label: c.l, value: c.v, unit: c.u })),
    };
  });

  return (
    <>
      <TopBar
        title={today}
        subtitle={phrase ?? undefined}
        actions={<Link href="/import" aria-label="Importer un fichier" className={ui.iconBtn}><Upload className="size-5" aria-hidden /></Link>}
      />
      <div className="space-y-8">
        {d.empty ? (
          <section className={cn(ui.card, "p-6")}>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight">Votre première sortie commence ici</h2>
            <p className="mt-2 text-[15px] text-ink-soft">Enregistrez une activité ou importez vos fichiers Strava et MyWhoosh : Pulse en tirera des anecdotes dès la première.</p>
            <Link href="/record" className={cn(ui.btnPrimary, "mt-5 w-full")}>Enregistrer une sortie</Link>
          </section>
        ) : (
          <Section title="Cette semaine" action={<span className="font-num text-sm tabular-nums text-ink-mute">{d.range}</span>}>
            <WeekCard
              run={{ done: d.runCount, target: d.targets.run }} lift={{ done: d.liftCount, target: d.targets.lift }}
              km={goal.km} goalKm={goal.goalKm} days={d.days}
            />
          </Section>
        )}

        {/* Course du jour : la carte du coach porte la course et le bouton principal, la muscu n'apparaît pas. */}
        <div className="space-y-3">
          {coach && !d.empty && <CoachCard c={coach} />}
          {run ? <ProgramCard p={run} /> : <><StartProgramCard /><PlanRouteCard /></>}
        </div>

        <div className="space-y-3 empty:hidden">
          <PendingBadgesCard items={pendingBadges} />
          {d.pendingResult && <PendingResultCard {...d.pendingResult} />}
          <GearAlert gear={worn.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))} />
          <InstallPrompt />
        </div>

        {!d.empty && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={HeartPulse} label="Forme" value={String(d.form.ctl)} delta={{ text: signed(d.form.delta), good: d.form.delta >= 0 }}
                spark={d.form.spark} sub={d.form.label} href="/fitness"
              />
              {race ? (
                <StatTile
                  icon={Flag} label="Prochaine course" title={race.name} tone="brand" value={race.days === 0 ? "Jour J" : `J-${race.days}`}
                  sub={race.targetDistance ? fmtRaceDistance(race.targetDistance) : race.prep} href="/events"
                />
              ) : (
                <StatTile icon={Flag} label="Prochaine course" value="—" sub="Ajoute ta prochaine course" href="/events?import=1" />
              )}
            </div>

            <Section title="Récent" action={<Link href="/activities" className="-my-3 inline-flex h-12 items-center text-sm font-semibold text-brand active:opacity-60">Tout voir</Link>}>
              <div className="space-y-3">
                {recent.map((a) => <ActivitySummary key={a.id} a={a} />)}
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
}
