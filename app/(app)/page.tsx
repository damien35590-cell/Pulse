import Link from "next/link";
import { HeartPulse, Target, Upload } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDashboard } from "@/lib/data/dashboard";
import { gearAlerts } from "@/lib/data/gear";
import { getRunProgram } from "@/lib/data/training";
import { fmtNum } from "@/lib/format";
import { SPORTS } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { WeekCard } from "@/components/dashboard/week-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ActivitySummary } from "@/components/dashboard/activity-summary";
import { EventTimeline } from "@/components/dashboard/event-timeline";
import { cells } from "@/components/dashboard/activity-card";
import { GearAlert } from "@/components/gear/gear-alert";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { ProgramCard, StartProgramCard } from "@/components/training/program-card";
import { PlanRouteCard } from "@/components/routes/plan-route-card";
import { CoachCard } from "@/components/dashboard/coach-card";
import { getCoach } from "@/lib/coach/load";

export const dynamic = "force-dynamic";

const TZ = "Europe/Paris";
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
// Muscu : durée, séries, volume. Autres sports : les 3 premiers chiffres de cells().
const LIFT = ["Durée", "Séries", "Volume"];

export default async function DashboardPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const [d, worn, run] = await Promise.all([getDashboard(s.user.id), gearAlerts(s.user.id), getRunProgram(s.user.id)]);
  // Le coach ne bloque jamais l'accueil : en cas de souci, la carte n'apparaît pas.
  const coach = await getCoach(s.user.id, run).catch((e) => { console.error("[coach]", e); return null; });
  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date());
  const goal = d.goals[0];
  const recent = d.recent.map((a) => {
    const all = cells(a), picked = a.type === "WORKOUT" ? LIFT.map((l) => all.find((c) => c.l === l)).filter((c) => !!c) : all;
    return {
      id: a.id, type: a.type, title: a.title, story: a.story ?? undefined, tags: a.muscles.length ? a.muscles : undefined,
      when: new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(a.startedAt),
      metrics: picked.slice(0, 3).map((c) => ({ label: c.l, value: c.v, unit: c.u })),
    };
  });

  return (
    <>
      <TopBar
        eyebrow={today}
        title="Aujourd’hui"
        subtitle={`Semaine du ${d.range} · ${d.weekCount} séance${d.weekCount > 1 ? "s" : ""}`}
        actions={<Link href="/import" aria-label="Importer un fichier" className={ui.iconBtn}><Upload className="size-5" aria-hidden /></Link>}
      />
      <div className="space-y-8">
        {coach && !d.empty && <CoachCard c={coach} />}
        {run ? <ProgramCard p={run} /> : <StartProgramCard />}

        <div className="space-y-3 empty:hidden">
          <GearAlert gear={worn.sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))} />
          <InstallPrompt />
        </div>

        <PlanRouteCard />

        {d.empty ? (
          <section className={cn(ui.card, "p-6")}>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight">Votre première sortie commence ici</h2>
            <p className="mt-2 text-[15px] text-ink-soft">Enregistrez une activité ou importez vos fichiers Strava et MyWhoosh : Pulse en tirera des anecdotes dès la première.</p>
            <Link href="/record" className={cn(ui.btnPrimary, "mt-5 w-full")}>Enregistrer une sortie</Link>
          </section>
        ) : (
          <>
            <Section title="Cette semaine" action={<span className="font-num text-sm tabular-nums text-ink-mute">{d.range}</span>}>
              <WeekCard done={d.weekCount} planned={d.plannedCount || undefined} runKm={d.runKm} liftT={d.liftT} days={d.days} />
            </Section>

            <div className="grid grid-cols-2 gap-3">
              <StatTile
                icon={HeartPulse} label="Forme" value={String(d.form.ctl)} delta={{ text: signed(d.form.delta), good: d.form.delta >= 0 }}
                spark={d.form.spark} sub={d.form.label} href="/fitness"
              />
              {goal && (
                <StatTile
                  icon={Target} label="Objectif" value={fmtNum(goal.km, 1)} unit={`/ ${fmtNum(goal.goalKm, 0)} km`}
                  progress={goal.goalKm > 0 ? goal.km / goal.goalKm : 0}
                  sub={goal.sport ? `${SPORTS[goal.sport]?.label ?? goal.sport} · cette semaine` : "Cette semaine"} href="/goals"
                />
              )}
            </div>

            {(d.events.length > 0 || d.pendingResult) && <EventTimeline events={d.events} pendingResult={d.pendingResult} />}

            <Section title="Récent" action={<Link href="/activities" className="text-sm font-semibold text-brand active:opacity-60">Tout voir</Link>}>
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
