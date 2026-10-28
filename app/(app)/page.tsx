import Link from "next/link";
import { Flag, HeartPulse } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDashboard } from "@/lib/data/dashboard";
import { gearAlerts } from "@/lib/data/gear";
import { getPendingBadges } from "@/lib/data/badges";
import { getRunProgram } from "@/lib/data/training";
import { fmtRaceDistance } from "@/lib/races/format";
import { formDeltaTone } from "@/lib/fitness";
import { cn } from "@/lib/utils";
import { ui } from "@/lib/ui";
import { TopBar } from "@/components/layout/top-bar";
import { Section } from "@/components/ui/section";
import { WeekCard } from "@/components/dashboard/week-card";
import { StatTile } from "@/components/dashboard/stat-tile";
import { ActivitySummary } from "@/components/dashboard/activity-summary";
import { PendingResultCard } from "@/components/dashboard/pending-result-card";
import { summaryData } from "@/lib/activity/summary";
import { getActivityInsights } from "@/lib/data/activity-insight";
import { getZones } from "@/lib/data/zones";
import { GearAlert } from "@/components/gear/gear-alert";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { DayCard, StartProgramCard } from "@/components/training/program-card";
import { PendingBadgesCard } from "@/components/profile/pending-badges-card";
import { Avatar } from "@/components/profile/avatar";
import { getCoach } from "@/lib/coach/load";

export const dynamic = "force-dynamic";

const TZ = "Europe/Paris";
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/** Avatar de la barre du haut : ouvre « Vous » (qui n'est plus un onglet), pastille Volt tant que des badges attendent. */
function ProfileButton({ name, image, pending }: { name: string; image: string | null; pending: number }) {
  return (
    <Link
      href="/vous"
      aria-label={pending > 0 ? `Vous, ${pending} badge${pending > 1 ? "s" : ""} à valider` : "Vous"}
      className="relative grid size-12 touch-manipulation place-items-center rounded-full transition duration-150 ease-snappy active:scale-90"
    >
      <Avatar name={name} image={image} className="size-9 text-sm" />
      {pending > 0 && (
        <span aria-hidden className="absolute right-0 top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 font-num text-xs font-semibold leading-none tabular-nums text-brand-ink">
          {pending > 99 ? "99+" : pending}
        </span>
      )}
    </Link>
  );
}

/**
 * Accueil : la semaine en tête, puis la carte du jour (coach + programme course en une carte), forme + prochaine course,
 * et la dernière activité. Créneau, météo et boucle vivent dans « Prépare ta sortie » (Itinéraires).
 */
export default async function DashboardPage() {
  const s = await auth();
  if (!s?.user?.id) redirect("/login");
  const [d, worn, run, pendingBadges, me] = await Promise.all([
    getDashboard(s.user.id), gearAlerts(s.user.id), getRunProgram(s.user.id),
    getPendingBadges(s.user.id).catch((e) => { console.error("[badges] accueil", e); return []; }),
    prisma.user.findUnique({ where: { id: s.user.id }, select: { name: true, image: true } }),
  ]);
  // Le coach ne bloque jamais l'accueil : en cas de souci, la carte montre seulement le programme.
  const coach = d.empty ? null : await getCoach(s.user.id, run).catch((e) => { console.error("[coach]", e); return null; });
  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date());
  const goal = d.goals[0];
  const race = d.events[0];
  // Récent : la dernière activité d'entraînement seulement (activités douces déjà exclues), même phrase de comparaison que la fiche.
  const last = d.recent.slice(0, 1);
  const insights = await getActivityInsights(s.user.id, last.map((a) => a.id), TZ, (await getZones(s.user.id)).hrMax).catch((e) => { console.error("[insight] accueil", e); return undefined; });
  const recent = last.map((a) => summaryData(a, insights?.get(a.id), TZ, { tags: a.muscles.length ? a.muscles : undefined }));
  const name = me?.name ?? s.user.email?.split("@")[0] ?? "Vous";

  return (
    <>
      <TopBar title={today} actions={<ProfileButton name={name} image={me?.image ?? null} pending={pendingBadges.length} />} />
      <div className="space-y-8">
        {d.empty ? (
          <section className={cn(ui.card, "p-6")}>
            <h2 className="text-[28px] font-bold leading-tight tracking-tight">Ta première sortie commence ici</h2>
            <p className="mt-2 text-[15px] text-ink-soft">Enregistre une activité ou importe tes fichiers Strava et MyWhoosh : Pulse en tirera des anecdotes dès la première.</p>
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

        {/* Carte du jour : séance du programme, muscu, repos ou séance faite, toujours une seule carte. */}
        <div className="space-y-3 empty:hidden">
          <DayCard c={coach} p={run} />
          {!run && <StartProgramCard />}
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
                icon={HeartPulse} label="Forme" value={String(d.form.ctl)} delta={{ text: signed(d.form.delta), tone: formDeltaTone(d.form.delta, d.fit.form) }}
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

            {recent.length > 0 && (
              <Section title="Récent" action={<Link href="/activities" className="-my-3 inline-flex h-12 items-center text-sm font-semibold text-brand active:opacity-60">Tout voir</Link>}>
                <ActivitySummary a={recent[0]} />
              </Section>
            )}
          </>
        )}
      </div>
    </>
  );
}
